import { prisma, type Prisma } from "@eoda/database";
import { appUrl } from "@/lib/config/app-url";
import { generateOneTimeToken, hashOneTimeToken, oneTimeTokenExpiry } from "@/lib/security/one-time-token";
import { PASSWORD_SETUP_TTL_HOURS, passwordSetupPathFor } from "@/lib/services/password-setup-service";

// Émet un lien de création du mot de passe pour un compte (audit du 28/10/2026). Les
// liens encore ouverts sont CLOS dans la même écriture : un seul lien vivant par compte.
// Rend l'URL complète, EN CLAIR, qui ne vit que le temps de partir par e-mail (ou de
// s'afficher une fois au cabinet si l'e-mail n'est pas parti) ; seule l'empreinte est
// écrite.
export async function issuePasswordSetupLink(userId: string, now: Date = new Date(), tx: Prisma.TransactionClient = prisma): Promise<string> {
  const token = generateOneTimeToken();
  await tx.passwordSetupToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
  await tx.passwordSetupToken.create({
    data: { userId, tokenHash: hashOneTimeToken(token), expiresAt: oneTimeTokenExpiry(now, PASSWORD_SETUP_TTL_HOURS) },
  });
  return appUrl(passwordSetupPathFor(token));
}
