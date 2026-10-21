"use server";

import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getEstablishmentSupportMode } from "@/lib/services/establishment-offer-service";
import { readCriteriaProofFor } from "@/lib/db/read-criteria-proof";
import {
  countImperativesProven,
  describeEvidence,
  type CriterionProofRow,
  type EvidenceItem,
  type ImperativesProof,
} from "@/lib/services/criteria-proof-service";
import { prisma } from "@eoda/database";
import { readChapters, readChapterTree } from "@/lib/db/referential-cache";
import { EXPECTED_IMPERATIVE_COUNT } from "@/lib/services/criterion-applicability-service";

// Onglet « Critères » d'une fiche structure, et cadre « Critères impératifs » de la
// vue d'ensemble (tranche N4). Garde : la fiche appartient au cabinet de l'appelant
// (notFound sinon) — l'identifiant vient de l'adresse, il n'est pas fiable.
export type StructureCriteriaProof = {
  rows: CriterionProofRow[];
  imperatives: ImperativesProof;
  // Repère du profil (16 SAD aide, 17 SAD mixte) — le décompte réel reste `imperatives.total`.
  expectedImperatives: number;
};

// Le DÉTAIL des preuves de chaque critère, pour l'onglet Critères (21/10/2026) :
// quels documents sont attendus, l'état de chacun, et ce que l'évaluateur HAS regarde
// (éléments d'évaluation du référentiel, en cache). Même garde que ci-dessous.
export type CriterionEvidence = { items: EvidenceItem[]; hasElements: string[] };

export async function getStructureCriteriaEvidence(establishmentId: string): Promise<Record<string, CriterionEvidence>> {
  const { establishmentId: id, establishmentType } = await requireEstablishmentInTenant(establishmentId, "READ");
  const mode = await getEstablishmentSupportMode(id);
  const [rows, documents, chapters] = await Promise.all([
    readCriteriaProofFor(id, establishmentType, mode),
    prisma.document.findMany({
      where: { establishmentId: id, documentTypeId: { not: null } },
      select: { documentTypeId: true, validatedAt: true, clientAcceptedAt: true, currentVersion: { select: { uploadedAt: true } } },
    }),
    readChapters().then((list) => Promise.all(list.map((c) => readChapterTree(c.number)))),
  ]);
  const typeIds = [...new Set(rows.flatMap((r) => r.expectedDocumentTypeIds))];
  const types = typeIds.length > 0 ? await prisma.documentType.findMany({ where: { id: { in: typeIds } }, select: { id: true, label: true } }) : [];

  const labels = new Map(types.map((t) => [t.id, t.label]));
  const byType = new Map(
    documents.flatMap((d) =>
      d.documentTypeId
        ? [[d.documentTypeId, { documentTypeId: d.documentTypeId, versionUploadedAt: d.currentVersion?.uploadedAt ?? null, validatedAt: d.validatedAt, clientAcceptedAt: d.clientAcceptedAt }] as const]
        : []
    )
  );
  const elementsByCriterion = new Map(
    chapters.flatMap((chapter) =>
      (chapter?.themes ?? []).flatMap((t) =>
        t.objectives.flatMap((o) =>
          o.criteria.map((c) => [c.id, c.evaluationElements.map((e) => e.reformulatedText ?? e.originalText)] as const)
        )
      )
    )
  );

  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      { items: describeEvidence(r.expectedDocumentTypeIds, byType, labels, mode), hasElements: elementsByCriterion.get(r.id) ?? [] },
    ])
  );
}

export async function getStructureCriteriaProof(establishmentId: string): Promise<StructureCriteriaProof> {
  const { establishmentId: id, establishmentType } = await requireEstablishmentInTenant(establishmentId, "READ");
  const mode = await getEstablishmentSupportMode(id);
  const rows = await readCriteriaProofFor(id, establishmentType, mode);
  return {
    rows,
    imperatives: countImperativesProven(rows),
    expectedImperatives: EXPECTED_IMPERATIVE_COUNT[establishmentType],
  };
}
