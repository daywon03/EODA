import { prisma } from "@eoda/database";
import type { CommercialTier, DocumentCategory } from "@eoda/database";
import {
  getCoveredDocumentCategories,
  isDocumentCategoryCovered,
} from "./offer-scope-service";

// Résolution de l'offre CONTRACTÉE par un établissement, à un seul endroit.
// L'offre vit sur `Mission.formule` (+ `gratuit`), jamais sur
// `Establishment.commercialTier` qui reste de l'affichage/historique
// (CLAUDE.md §7). Lecture (checklist.ts) et mutations (document.ts) passent
// toutes deux par ici : deux résolutions parallèles finiraient par diverger
// (D1 anti-duplication).
//
// ⚠️ Règle « pas de mission ⇒ pas de périmètre contracté » : `null` ci-dessous.
// C'est l'état d'AVANT-VENTE, où la checklist documentaire complète reste
// affichée pour préparer le devis. Les mutations doivent s'accorder exactement
// avec cette règle : bloquer les dépôts sans mission casserait le parcours
// d'avant-vente (une checklist affichée qu'aucun dépôt ne pourrait honorer).

async function findMissionOffer(
  establishmentId: string
): Promise<{ formule: CommercialTier; gratuit: boolean } | null> {
  return prisma.mission.findUnique({
    where: { establishmentId },
    select: { formule: true, gratuit: true },
  });
}

// Catégories documentaires suivies pour cet établissement.
// `null` = aucune mission, donc aucun filtrage à appliquer (avant-vente).
export async function getEstablishmentCoveredCategories(
  establishmentId: string
): Promise<readonly DocumentCategory[] | null> {
  const mission = await findMissionOffer(establishmentId);
  if (!mission) return null;
  return getCoveredDocumentCategories(mission.formule, mission.gratuit);
}

// Décision unitaire : cette catégorie entre-t-elle dans l'offre contractée ?
// `true` sans mission — même règle d'avant-vente que ci-dessus.
export async function isCategoryCoveredForEstablishment(
  establishmentId: string,
  category: DocumentCategory
): Promise<boolean> {
  const mission = await findMissionOffer(establishmentId);
  if (!mission) return true;
  return isDocumentCategoryCovered(mission.formule, mission.gratuit, category);
}
