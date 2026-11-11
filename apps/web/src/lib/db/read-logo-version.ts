import { cache } from "react";
import { prisma } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// LE LOGO EXISTE-T-IL, ET DE QUAND DATE-T-IL ? (11/11/2026 — performance)
//
// Le logo est un data URI de ~250 Ko. Le portail client l'écrivait DEUX fois dans
// chaque page (en-tête et barre latérale) : un demi-mégaoctet de charge utile à
// chaque clic, et autant tiré de la base. L'écran n'a besoin que de savoir s'il
// existe, et d'une version pour que le navigateur, qui met la route du logo en
// cache, en recharge un nouveau : la date de mise à jour de la fiche.
//
// Projection minuscule, mémoïsée PAR RENDU (`react.cache`) — jamais entre deux
// requêtes. L'identifiant reçu n'est pas une autorisation : l'appelant l'a déjà
// obtenu de sa garde.
// ─────────────────────────────────────────────────────────────────────────────
export const readLogoVersion = cache(async (establishmentId: string): Promise<number | null> => {
  const row = await prisma.establishment.findFirst({
    where: { id: establishmentId, logoDataUri: { not: null } },
    select: { updatedAt: true },
  });
  return row ? row.updatedAt.getTime() : null;
});
