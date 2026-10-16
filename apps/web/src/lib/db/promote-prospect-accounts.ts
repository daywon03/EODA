import type { Prisma } from "@eoda/database";
import {
  PROMOTED_ACCESS_ROLE,
  PROMOTED_POSITION,
  selectAccountsToPromote,
} from "@/lib/services/conversion-service";

// Bascule des comptes libre-service d'un prospect en accès client à la fiche qui
// vient de naître (tranche 11). Appelée DANS la transaction de signature
// (lib/actions/conversion.ts) : une fiche signée sans accès pour la structure qui
// s'était inscrite, ou un accès sans fiche, sont deux états à ne jamais réparer à la
// main. Règles pures dans conversion-service.ts (selectAccountsToPromote).
//
// La condition `role: "PROSPECT_USER"` est répétée dans l'écriture : la base tranche,
// même si un rôle a changé entre la lecture et l'écriture. Le lien est créé avec
// `skipDuplicates` (clé primaire userId + establishmentId).
export async function promoteProspectAccounts(
  tx: Prisma.TransactionClient,
  prospectId: string,
  establishmentId: string
): Promise<string[]> {
  const links = await tx.prospectAccount.findMany({
    where: { prospectId },
    select: { userId: true, user: { select: { role: true } } },
  });
  const userIds = selectAccountsToPromote(links.map((link) => ({ userId: link.userId, role: link.user.role })));
  if (userIds.length === 0) return [];

  await tx.user.updateMany({
    where: { id: { in: userIds }, role: "PROSPECT_USER" },
    data: { role: "CLIENT_USER" },
  });
  await tx.establishmentUser.createMany({
    data: userIds.map((userId) => ({
      userId,
      establishmentId,
      roleInEstablishment: PROMOTED_POSITION,
      accessRole: PROMOTED_ACCESS_ROLE,
    })),
    skipDuplicates: true,
  });
  return userIds;
}
