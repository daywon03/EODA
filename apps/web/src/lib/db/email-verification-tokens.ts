import type { Prisma } from "@eoda/database";
import { generateOneTimeToken, hashOneTimeToken, oneTimeTokenExpiry } from "@/lib/security/one-time-token";
import { EMAIL_VERIFICATION_TTL_HOURS } from "@/lib/services/email-verification-service";

// Émet un lien de confirmation pour un compte (tranche 11). Les liens précédents
// encore ouverts sont CLOS (usedAt posé) dans la même écriture : un seul lien vivant
// par compte, celui du dernier e-mail — un ancien lien retrouvé dans une boîte ne
// sert plus. Rend le jeton EN CLAIR, qui ne vit que le temps de partir par e-mail ;
// seule son empreinte est écrite.
export async function issueEmailVerificationToken(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date
): Promise<string> {
  const token = generateOneTimeToken();
  await tx.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
  await tx.emailVerificationToken.create({
    data: { userId, tokenHash: hashOneTimeToken(token), expiresAt: oneTimeTokenExpiry(now, EMAIL_VERIFICATION_TTL_HOURS) },
  });
  return token;
}
