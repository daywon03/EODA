import { prisma, type EstablishmentType, type SupportMode } from "@eoda/database";
import { isCriterionApplicable } from "@/lib/services/criterion-applicability-service";
import { isCriterionImperativeForEstablishment } from "@/lib/services/criterion-imperativeness-service";
import { buildCriteriaProofRows, type CriterionProofRow } from "@/lib/services/criteria-proof-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE « critères & preuves » pour une ou plusieurs structures (tranche N4).
//
// Aucune garde ici : l'appelant a DÉJÀ borné `establishments` à son périmètre
// (requireEstablishmentInTenant pour une fiche, liste du tenant pour « Structures »).
// Trois requêtes quel que soit le nombre de structures — jamais une par structure.
// La règle (prouvé / en partie / sans preuve) vit dans criteria-proof-service.
// ─────────────────────────────────────────────────────────────────────────────

export type ProofTarget = { id: string; type: EstablishmentType; mode: SupportMode };

export async function readCriteriaProof(
  targets: readonly ProofTarget[]
): Promise<Map<string, CriterionProofRow[]>> {
  const result = new Map<string, CriterionProofRow[]>();
  if (targets.length === 0) return result;

  const [criteria, documents] = await Promise.all([
    prisma.criterion.findMany({
      select: {
        id: true,
        code: true,
        label: true,
        requirementLevel: true,
        applicableTo: true,
        objective: { select: { theme: { select: { chapter: { select: { number: true } } } } } },
        documentTypes: { select: { documentTypeId: true } },
      },
    }),
    prisma.document.findMany({
      where: { establishmentId: { in: targets.map((t) => t.id) }, documentTypeId: { not: null } },
      select: {
        establishmentId: true,
        documentTypeId: true,
        validatedAt: true,
        clientAcceptedAt: true,
        currentVersion: { select: { uploadedAt: true } },
      },
    }),
  ]);

  for (const target of targets) {
    const sources = criteria
      .filter((c) => isCriterionApplicable(c.applicableTo, target.type))
      .map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        chapterNumber: c.objective.theme.chapter.number,
        isImperative: isCriterionImperativeForEstablishment(c, target.type),
        expectedDocumentTypeIds: c.documentTypes.map((d) => d.documentTypeId),
      }));
    const docs = documents
      .filter((d) => d.establishmentId === target.id)
      .flatMap((d) =>
        d.documentTypeId
          ? [
              {
                documentTypeId: d.documentTypeId,
                versionUploadedAt: d.currentVersion?.uploadedAt ?? null,
                validatedAt: d.validatedAt,
                clientAcceptedAt: d.clientAcceptedAt,
              },
            ]
          : []
      );
    result.set(target.id, buildCriteriaProofRows(sources, docs, target.mode));
  }
  return result;
}
