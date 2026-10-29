"use server";

import { prisma } from "@eoda/database";
import { headers } from "next/headers";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { clientIpFromHeaders } from "@/lib/security/login-throttle";
import { decideOneTimeTokenState, hashOneTimeToken, isOneTimeTokenWellFormed, oneTimeTokenMatches } from "@/lib/security/one-time-token";
import { hashPassword } from "@/lib/security/password-hashing";
import { validateNewPassword } from "@/lib/security/password-policy";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { PASSWORD_SETUP_IP_RATE_LIMIT, PASSWORD_SETUP_LINK_MESSAGES, type PasswordSetupLinkState } from "@/lib/services/password-setup-service";

// ─────────────────────────────────────────────────────────────────────────────
// CRÉATION DU MOT DE PASSE PAR LIEN — deux actions PUBLIQUES (audit du 28/10/2026).
//
// Aucune session : le jeton EST l'autorisation, et il n'ouvre qu'une chose — poser le
// mot de passe de SON compte, une fois. Entrées hostiles (S8) : forme du jeton vérifiée
// avant toute lecture, débit limité par IP, empreinte comparée en temps constant, usage
// unique posé ATOMIQUEMENT (updateMany conditionnel), dans la même transaction que le
// mot de passe. Même socle que la confirmation d'adresse (email-verification.ts).
// ─────────────────────────────────────────────────────────────────────────────

async function ipKey(): Promise<string> {
  return `password-setup:${clientIpFromHeaders(await headers())}`;
}

async function readLink(token: unknown) {
  if (!isOneTimeTokenWellFormed(token)) return null;
  const row = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash: hashOneTimeToken(token) },
    select: { id: true, tokenHash: true, userId: true, expiresAt: true, usedAt: true, user: { select: { email: true, isActive: true } } },
  });
  if (!row || !oneTimeTokenMatches(row.tokenHash, token) || !row.user.isActive) return null;
  return row;
}

// Ouverture de la page : dit si le lien sert encore, SANS le consommer (un scanner de
// messagerie qui suit le lien ne le brûle pas). L'adresse s'affiche pour que la
// personne sache pour quel compte elle choisit un mot de passe.
export async function openPasswordSetupLink(token: string): Promise<{ state: PasswordSetupLinkState; email: string | null }> {
  const allowed = await consumeThrottledAttempt({ key: await ipKey(), policy: PASSWORD_SETUP_IP_RATE_LIMIT, auditAction: "PASSWORD_SETUP_RATE_LIMITED" });
  if (!allowed) return { state: "INVALID", email: null };
  const row = await readLink(token);
  if (!row) return { state: "INVALID", email: null };
  const state = decideOneTimeTokenState(row, new Date());
  return { state, email: state === "VALID" ? row.user.email : null };
}

export type PasswordSetupResult = { status: "IDLE" } | { status: "ERROR"; error: string } | { status: "DONE" };

function raw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function setPasswordFromLink(_prev: PasswordSetupResult, formData: FormData): Promise<PasswordSetupResult> {
  const allowed = await consumeThrottledAttempt({ key: await ipKey(), policy: PASSWORD_SETUP_IP_RATE_LIMIT, auditAction: "PASSWORD_SETUP_RATE_LIMITED" });
  if (!allowed) return { status: "ERROR", error: "Trop de tentatives. Réessayez dans quelques minutes." };

  const newPassword = raw(formData, "newPassword");
  const policy = validateNewPassword({ currentPassword: "", newPassword, confirmation: raw(formData, "confirmation") });
  if (!policy.ok) return { status: "ERROR", error: policy.error };

  const row = await readLink(formData.get("token"));
  if (!row) return { status: "ERROR", error: PASSWORD_SETUP_LINK_MESSAGES.INVALID };
  const now = new Date();
  const state = decideOneTimeTokenState(row, now);
  if (state !== "VALID") return { status: "ERROR", error: PASSWORD_SETUP_LINK_MESSAGES[state] };

  const passwordHash = await hashPassword(newPassword);
  const claimed = await prisma.$transaction(async (tx) => {
    // Usage unique sous concurrence : seule la première requête passe la condition.
    const claim = await tx.passwordSetupToken.updateMany({ where: { id: row.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claim.count === 0) return false;
    // `passwordChangedAt` révoque toute session ouverte avant (gardes).
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: now } });
    return true;
  });
  if (!claimed) return { status: "ERROR", error: PASSWORD_SETUP_LINK_MESSAGES.USED };

  await recordAuditEvent({ action: "PASSWORD_SET_FROM_LINK", actorUserId: row.userId, targetId: row.userId });
  return { status: "DONE" };
}
