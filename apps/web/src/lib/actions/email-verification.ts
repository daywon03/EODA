"use server";

import { prisma } from "@eoda/database";
import { after } from "next/server";
import { headers } from "next/headers";
import { getEnv } from "@/lib/config/env";
import { issueEmailVerificationToken } from "@/lib/db/email-verification-tokens";
import { sendEmailConfirmationEmail } from "@/lib/email/notifications";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { clientIpFromHeaders } from "@/lib/security/login-throttle";
import {
  decideOneTimeTokenState,
  hashOneTimeToken,
  isOneTimeTokenWellFormed,
  oneTimeTokenMatches,
} from "@/lib/security/one-time-token";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  CONFIRM_IP_RATE_LIMIT,
  confirmationLinkDisclosure,
  confirmationPathFor,
  parseResendEmail,
  RESEND_EMAIL_RATE_LIMIT,
  RESEND_IP_RATE_LIMIT,
  RESEND_NEUTRAL_MESSAGE,
  RESEND_RATE_LIMITED_MESSAGE,
  resendThrottleKeys,
  shouldIssueVerificationLink,
  type ConfirmationOutcome,
  type LinkDisclosure,
} from "@/lib/services/email-verification-service";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMATION D'ADRESSE — deux actions PUBLIQUES (tranche 11).
//
// Aucune session : le jeton EST l'autorisation, et il n'ouvre qu'une chose — poser
// `emailVerifiedAt` sur SON compte, une fois. Entrées hostiles (S8) : forme du jeton
// vérifiée avant toute lecture, débit limité, empreinte comparée en temps constant,
// usage unique posé ATOMIQUEMENT (updateMany conditionnel). Le renvoi répond la même
// chose que l'adresse existe ou non (S9) ; son travail réel part APRÈS la réponse
// (`after`), pour que la durée de la réponse ne dise rien du compte non plus.
// ─────────────────────────────────────────────────────────────────────────────

export type ConfirmEmailState = { outcome: ConfirmationOutcome | null };

async function ipKey(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

export async function confirmEmailAddress(_prev: ConfirmEmailState, formData: FormData): Promise<ConfirmEmailState> {
  const token = formData.get("token");
  if (!isOneTimeTokenWellFormed(token)) return { outcome: "INVALID" };
  const allowed = await consumeThrottledAttempt({
    key: `verify-confirm:${await ipKey()}`,
    policy: CONFIRM_IP_RATE_LIMIT,
    auditAction: "EMAIL_VERIFICATION_RATE_LIMITED",
  });
  if (!allowed) return { outcome: "RATE_LIMITED" };

  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashOneTimeToken(token) },
    select: { id: true, tokenHash: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!row || !oneTimeTokenMatches(row.tokenHash, token)) return { outcome: "INVALID" };

  const now = new Date();
  const state = decideOneTimeTokenState(row, now);
  if (state !== "VALID") return { outcome: state };

  const claimed = await prisma.$transaction(async (tx) => {
    // Usage unique sous concurrence : seul le premier clic passe la condition.
    const claim = await tx.emailVerificationToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claim.count === 0) return false;
    await tx.user.updateMany({ where: { id: row.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    return true;
  });
  if (!claimed) return { outcome: "USED" };

  await recordAuditEvent({ action: "EMAIL_VERIFIED", actorUserId: row.userId, targetId: row.userId });
  return { outcome: "CONFIRMED" };
}

export type ResendLinkState =
  | { status: "IDLE" }
  | { status: "ERROR"; error: string }
  | { status: "DONE"; message: string; disclosure: LinkDisclosure };

async function issueAndSend(account: { id: string; email: string; name: string; structureName: string | null }): Promise<string> {
  const token = await prisma.$transaction((tx) => issueEmailVerificationToken(tx, account.id, new Date()));
  const confirmationPath = confirmationPathFor(token);
  await sendEmailConfirmationEmail({
    email: account.email,
    firstName: account.name,
    structureName: account.structureName,
    confirmationPath,
  });
  await recordAuditEvent({ action: "EMAIL_VERIFICATION_SENT", actorUserId: account.id, targetId: account.id, detail: "renvoi" });
  return confirmationPath;
}

export async function resendVerificationLink(_prev: ResendLinkState, formData: FormData): Promise<ResendLinkState> {
  const email = parseResendEmail(formData.get("email"));
  if (!email) return { status: "ERROR", error: "Votre adresse e-mail n'est pas valide." };

  const keys = resendThrottleKeys(await ipKey(), email);
  const allowed =
    (await consumeThrottledAttempt({ key: keys.ip, policy: RESEND_IP_RATE_LIMIT, auditAction: "EMAIL_VERIFICATION_RATE_LIMITED" })) &&
    (await consumeThrottledAttempt({ key: keys.email, policy: RESEND_EMAIL_RATE_LIMIT, auditAction: "EMAIL_VERIFICATION_RATE_LIMITED" }));
  if (!allowed) return { status: "ERROR", error: RESEND_RATE_LIMITED_MESSAGE };

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      emailVerifiedAt: true,
      prospectAccount: { select: { prospect: { select: { structureName: true } } } },
    },
  });
  const account = user
    ? {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        emailVerifiedAt: user.emailVerifiedAt,
        isSelfRegistered: user.prospectAccount !== null,
        structureName: user.prospectAccount?.prospect.structureName ?? null,
      }
    : null;

  const env = getEnv();
  const isEmailConfigured = env.resend !== null;
  // En développement sans service d'e-mail, le lien est montré à l'écran : il faut
  // donc l'avoir AVANT de répondre. Partout ailleurs, le travail part après la réponse.
  const showsLinkOnScreen = env.isDevelopment && !isEmailConfigured;
  let confirmationPath: string | null = null;
  if (account && shouldIssueVerificationLink(account)) {
    if (showsLinkOnScreen) confirmationPath = await issueAndSend(account);
    else after(() => issueAndSend(account));
  }

  return {
    status: "DONE",
    message: RESEND_NEUTRAL_MESSAGE,
    disclosure: confirmationLinkDisclosure({ isDevelopment: env.isDevelopment, isEmailConfigured, confirmationPath }),
  };
}
