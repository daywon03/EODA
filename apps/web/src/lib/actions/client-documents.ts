"use server";

import { prisma, type PricingUnit } from "@eoda/database";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { readContractData, type ContractReadResult } from "@/lib/db/read-contract-data";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// SES PROPRES DOCUMENTS CONTRACTUELS — le devis signé et le contrat.
//
// Le portail client affichait déjà les CHIFFRES du contrat (offre, options, montant
// signé, acompte, solde) mais jamais les DOCUMENTS eux-mêmes : pour relire son devis,
// le client devait retrouver le PDF dans sa boîte mail — c'est-à-dire retourner
// exactement là d'où ce portail existe pour le sortir.
//
// 🔐 AUCUN IDENTIFIANT N'ENTRE ICI, et c'est la décision de conception centrale. Le
// devis et le contrat sont résolus depuis le lien `EstablishmentUser` de la session,
// comme le fil d'échange. Il n'y a donc rien à falsifier : pas d'`?id=` dans l'URL,
// pas de paramètre à vérifier, pas de classe IDOR possible sur ces routes. Ouvrir les
// routes d'impression du cabinet en assouplissant leur garde aurait été plus court —
// et aurait créé deux endroits où se tromper.
//
// Ce que le client NE voit jamais : un devis en brouillon, envoyé, refusé ou annulé.
// Un seul état donne accès au document — SIGNÉ — parce que c'est le seul qui fait
// contrat. Montrer un brouillon reviendrait à laisser lire une négociation en cours.
// ─────────────────────────────────────────────────────────────────────────────

export type OwnDevis = {
  number: string;
  createdAt: Date;
  validUntil: Date;
  prospectStructureName: string;
  formuleLabelSnapshot: string;
  formulePriceSnapshotEuros: number;
  options: {
    labelSnapshot: string;
    priceSnapshotEuros: number;
    pricingUnitSnapshot: PricingUnit;
    priceMaxSnapshotEuros: number | null;
    minQuantitySnapshot: number | null;
  }[];
  totalAmountEuros: number;
  depositPercent: number;
  depositAmountEuros: number;
  balanceAmountEuros: number;
  installmentCount: number;
  installmentAmountEuros: number;
};

export async function getOwnSignedDevis(): Promise<OwnDevis | null> {
  const { establishment, userId, session } = await requireClientEstablishment();
  if (!establishment) return null;

  // Le lien Establishment → Devis n'est pas direct : un devis pend d'un Prospect, et
  // c'est `Prospect.establishmentId` qui referme la boucle. Aucune autre jointure
  // n'existe — surtout pas un rapprochement par nom, qui associerait deux structures
  // homonymes (CLAUDE.md §7).
  const devis = await prisma.devis.findFirst({
    where: { status: "SIGNE", prospect: { establishmentId: establishment.id } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      createdAt: true,
      validUntil: true,
      formuleLabelSnapshot: true,
      formulePriceSnapshotEuros: true,
      totalAmountEuros: true,
      depositPercent: true,
      depositAmountEuros: true,
      balanceAmountEuros: true,
      installmentCount: true,
      installmentAmountEuros: true,
      prospect: { select: { structureName: true } },
      options: {
        select: {
          labelSnapshot: true,
          priceSnapshotEuros: true,
          pricingUnitSnapshot: true,
          priceMaxSnapshotEuros: true,
          minQuantitySnapshot: true,
        },
        orderBy: { labelSnapshot: "asc" },
      },
    },
  });
  if (!devis) return null;

  // Journalisé comme tout accès à un document : secteur médico-social, traçabilité
  // attendue. `detail` = le numéro du devis, une clé technique — jamais un nom.
  await recordAuditEvent({
    action: "DOCUMENT_DOWNLOADED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: establishment.id,
    targetId: devis.id,
    detail: `devis ${devis.number} consulté par le client`,
  });

  return {
    number: devis.number,
    createdAt: devis.createdAt,
    validUntil: devis.validUntil,
    prospectStructureName: devis.prospect.structureName,
    formuleLabelSnapshot: devis.formuleLabelSnapshot,
    formulePriceSnapshotEuros: devis.formulePriceSnapshotEuros,
    options: devis.options,
    totalAmountEuros: devis.totalAmountEuros,
    depositPercent: devis.depositPercent,
    depositAmountEuros: devis.depositAmountEuros,
    balanceAmountEuros: devis.balanceAmountEuros,
    installmentCount: devis.installmentCount,
    installmentAmountEuros: devis.installmentAmountEuros,
  };
}

// Le contrat d'accompagnement, vu par la structure qu'il engage. Même lecture que
// côté cabinet (`lib/db/read-contract-data.ts`), autre garde : le tenant n'est pas
// pris dans la session mais relu depuis l'établissement du lien — un compte client
// n'en porte pas.
export async function getOwnContract(): Promise<ContractReadResult | null> {
  const { establishment, userId, session } = await requireClientEstablishment();
  if (!establishment) return null;

  const record = await prisma.establishment.findUnique({
    where: { id: establishment.id },
    select: { tenantId: true },
  });
  if (!record) return null;

  const data = await readContractData(establishment.id, record.tenantId);
  if (!data) return null;

  await recordAuditEvent({
    action: "DOCUMENT_DOWNLOADED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: establishment.id,
    detail: "contrat d'accompagnement consulté par le client",
  });

  return data;
}
