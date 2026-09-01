"use server";

import { prisma } from "@eoda/database";
import { requireCabinetSession } from "@/lib/auth/guards";
import type { ContractFacts } from "@/lib/services/contract-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DU CONTRAT D'ACCOMPAGNEMENT — dernière étape du parcours de conversion.
//
// Fichier séparé de `lib/actions/mission.ts`, qui frôle déjà 600 lignes (D4) : le
// contrat a sa propre lecture, pas les mêmes écritures, et rien à partager avec le
// suivi de mission au-delà du modèle.
//
// Réservé au Cabinet (`requireCabinetSession` : identité + tenant, fail-closed) —
// c'est le cabinet qui édite le contrat, même si le document part chez le client. Un
// `establishmentId` reçu ici vient d'une route HTTP publique : le filtre `tenantId`
// de la requête est ce qui interdit de lire la fiche d'un autre tenant, et l'absence
// de résultat donne `null`, que l'appelant transforme en `notFound()`.
// ─────────────────────────────────────────────────────────────────────────────

// Le logo de la structure n'est pas un FAIT du contrat — `contract-service` est pur
// et ne connaît aucune image. Il voyage donc à côté des faits, dans le même aller-
// retour en base : une seconde requête (et une seconde garde) pour lire une colonne
// déjà chargée serait du gaspillage, pas de la séparation.
export type ContractReadResult = {
  facts: ContractFacts;
  establishmentLogo: string | null;
};

export async function getContractData(
  establishmentId: string
): Promise<ContractReadResult | null> {
  const { tenantId } = await requireCabinetSession();

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
