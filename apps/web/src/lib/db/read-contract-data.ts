import { prisma } from "@eoda/database";
import type { ContractFacts } from "@/lib/services/contract-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DU CONTRAT — la requête, sans la garde.
//
// Deux portes mènent au même contrat : le cabinet, pour l'émettre, et le client, pour
// lire le sien. Ce ne sont pas les mêmes autorisations — l'une filtre par tenant,
// l'autre résout l'établissement depuis le lien de session — mais c'est exactement la
// même lecture. La dupliquer, c'était garantir qu'une correction serait appliquée
// d'un seul côté (D1).
//
// ⚠️ CE MODULE N'EST PAS "use server", et c'est la raison d'être du fichier. Dans un
// fichier d'actions serveur, toute fonction exportée devient appelable depuis le
// navigateur : exporter un lecteur SANS GARDE qui accepte un `establishmentId` et un
// `tenantId` en paramètres reviendrait à publier une route qui lit le contrat de
// n'importe qui. Les gardes restent dans les actions, la requête vit ici.
// ─────────────────────────────────────────────────────────────────────────────

export type ContractReadResult = {
  facts: ContractFacts;
  establishmentLogo: string | null;
};

export async function readContractData(
  establishmentId: string,
  tenantId: string
): Promise<ContractReadResult | null> {
  const mission = await prisma.mission.findFirst({
    where: { establishmentId, tenantId },
    select: {
      formule: true,
      gratuit: true,
      createdAt: true,
      establishment: {
        select: {
          name: true,
          finessNumber: true,
          siretNumber: true,
          address: true,
          logoDataUri: true,
          hasEvaluationTargetDate: true,
        },
      },
      sourceDevis: {
        select: {
          number: true,
          totalAmountEuros: true,
          depositPercent: true,
          depositAmountEuros: true,
          balanceAmountEuros: true,
          installmentCount: true,
          installmentAmountEuros: true,
        },
      },
      options: {
        select: {
          labelSnapshot: true,
          priceSnapshotEuros: true,
          pricingUnitSnapshot: true,
          priceMaxSnapshotEuros: true,
          minQuantitySnapshot: true,
          priceIsFirm: true,
        },
        orderBy: { labelSnapshot: "asc" },
      },
    },
  });
  if (!mission) return null;

  // Libellé de l'offre lu au CATALOGUE du tenant, et non recopié : le contrat décrit
  // le périmètre, et c'est le catalogue qui en porte la description à jour. Les
  // MONTANTS, eux, viennent du devis signé — jamais du catalogue, dont les prix sont
  // des « à partir de » (CLAUDE.md §7).
  const formule = await prisma.catalogueFormule.findFirst({
    where: { tenantId, formule: mission.formule },
    select: { label: true, modulesLabel: true },
  });

  const devis = mission.sourceDevis;

  return {
    establishmentLogo: mission.establishment.logoDataUri,
    facts: {
      establishmentName: mission.establishment.name,
      finessNumber: mission.establishment.finessNumber,
      siretNumber: mission.establishment.siretNumber,
      address: mission.establishment.address,
      formule: mission.formule,
      formuleLabel: formule?.label ?? mission.formule,
      modulesLabel: formule?.modulesLabel ?? null,
      gratuit: mission.gratuit,
      options: mission.options,
      devisNumber: devis?.number ?? null,
      // Même règle que l'avenant : la conversion crée la mission ET pose le lien vers
      // le devis dans une seule transaction, la date de création de la mission EST donc
      // celle de la signature. Sans devis, elle ne daterait rien.
      signedOn: devis ? mission.createdAt : null,
      totalAmountEuros: devis?.totalAmountEuros ?? null,
      depositPercent: devis?.depositPercent ?? null,
      depositAmountEuros: devis?.depositAmountEuros ?? null,
      balanceAmountEuros: devis?.balanceAmountEuros ?? null,
      installmentCount: devis?.installmentCount ?? null,
      installmentAmountEuros: devis?.installmentAmountEuros ?? null,
      hasEvaluationTargetDate: mission.establishment.hasEvaluationTargetDate,
    },
  };
}
