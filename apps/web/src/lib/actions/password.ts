"use server";

import { prisma } from "@eoda/database";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { requirePasswordRotationSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { clientIpFromHeaders } from "@/lib/security/login-throttle";
import { PASSWORD_CHANGE_RATE_LIMIT } from "@/lib/security";
import { validateNewPassword } from "@/lib/security/password-policy";
import { hashPassword } from "@/lib/security/password-hashing";

// Message unique pour tout refus lié au mot de passe courant — ne jamais distinguer
// « mot de passe faux » de « compte introuvable », même derrière une session valide.
const GENERIC_CURRENT_PASSWORD_ERROR = "Le mot de passe actuel est incorrect.";

export type ChangePasswordResult = { success: true } | { error: string };

function throttleKey(ip: string, userId: string): string {
  return `password-change:${ip}:${userId}`;
}

// Lecture BRUTE, volontairement hors de lib/validation/form-parsers.ts : les parseurs
// y normalisent (trim, casse, bornes de longueur), ce qui est juste pour un nom et
// faux pour un mot de passe — une espace en début ou en fin fait partie du secret.
function readRawField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function changePasswordAction(formData: FormData): Promise<ChangePasswordResult> {
  // Garde dédiée : c'est la seule route authentifiée ouverte à un compte dont la
  // rotation est due. Elle refuse en revanche une session périmée.
  const { userId, session } = await requirePasswordRotationSession();

  const currentPassword = readRawField(formData, "currentPassword");
  const newPassword = readRawField(formData, "newPassword");
  const confirmation = readRawField(formData, "confirmation");

  // Limitation de débit AVANT toute comparaison bcrypt : l'action est un oracle de
  // vérification du mot de passe courant, exactement comme la page de connexion.
  const key = throttleKey(clientIpFromHeaders(await headers()), userId);
  const allowed = await consumeThrottledAttempt({
    key,
    policy: PASSWORD_CHANGE_RATE_LIMIT,
    auditAction: "PASSWORD_CHANGE_RATE_LIMITED",
    actorUserId: userId,
  });
  if (!allowed) {
    return {
      error: `Trop de tentatives. Nouvel essai possible dans ${Math.ceil(PASSWORD_CHANGE_RATE_LIMIT.windowSeconds / 60)} minutes.`,
    };
  }

  const policy = validateNewPassword({ currentPassword, newPassword, confirmation });
  if (!policy.ok) return { error: policy.error };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, role: true },
  });
  if (!user) return { error: GENERIC_CURRENT_PASSWORD_ERROR };

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    await recordAuditEvent({
      action: "PASSWORD_CHANGE_FAILED",
      actorUserId: userId,
      actorRole: user.role,
      detail: "mot de passe actuel incorrect",
    });
    return { error: GENERIC_CURRENT_PASSWORD_ERROR };
  }

  // `passwordChangedAt` fait office d'horodatage de révocation : les gardes refusent
  // toute session dont `authAt` lui est antérieur, y compris ouverte ailleurs.
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });

  await recordAuditEvent({
    action: "PASSWORD_CHANGED",
    actorUserId: userId,
    actorRole: session.user.role,
    detail: "rotation effectuée par l'utilisateur",
  });

  return { success: true };
}
