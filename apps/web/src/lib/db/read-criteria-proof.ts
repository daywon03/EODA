import { cache } from "react";
import { prisma, type EstablishmentType, type SupportMode } from "@eoda/database";
import { isCriterionApplicable } from "@/lib/services/criterion-applicability-service";
import { isCriterionImperativeForEstablishment } from "@/lib/services/criterion-imperativeness-service";
import { buildCriteriaProofRows, type CriterionProofRow } from "@/lib/services/criteria-proof-service";
import { withoutHiddenTypes } from "@/lib/services/document-type-exclusion-service";
import { readCriteriaWithMatrix } from "./referential-cache";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE « critères & preuves » pour une ou plusieurs structures (tranche N4).
//
// Aucune garde ici : l'appelant a DÉJÀ borné `establishments` à son périmètre
// (requireEstablishmentInTenant pour une fiche, liste du tenant pour « Structures »).
// Trois requêtes quel que soit le nombre de structures — jamais une par structure.
// La règle (prouvé / en partie / sans preuve) vit dans criteria-proof-service.
// ─────────────────────────────────────────────────────────────────────────────

export type ProofTarget = { id: string; type: EstablishmentType; mode: SupportMode };

// Une seule structure, MÉMOÏSÉE PAR RENDU (`react.cache`) : l'onglet Critères, le
// cadre « Critères impératifs » et le diagnostic de la même vue d'ensemble faisaient
// chacun le calcul complet (21/10/2026). Clé : (structure, profil, mode).
export const readCriteriaProofFor = cache(
  async (id: string, type: EstablishmentType, mode: SupportMode): Promise<CriterionProofRow[]> =>
    (await readCriteriaProof([{ id, type, mode }])).get(id) ?? []
);

export async function readCriteriaProof(
  targets: readonly ProofTarget[]
): Promise<Map<string, CriterionProofRow[]>> {
  const result = new Map<string, CriterionProofRow[]>();
  if (targets.length === 0) return result;

  const [criteria, documents, exclusions] = await Promise.all([
    // Référentiel + matrice : communs à tous, gardés en cache (referential-cache.ts).
    readCriteriaWithMatrix(),
    prisma.document.findMany({
      where: { establishmentId: { in: targets.map((t) => t.id) }, documentTypeId: { not: null } },
      select: {
        establishmentId: true,
        documentTypeId: true,
        validatedAt: true,
        clientAcceptedAt: true,
        status: true,
        currentVersion: { select: { uploadedAt: true, uploadedBy: { select: { role: true } } } },
      },
    }),
    // Lignes masquées pour chaque structure (10/11/2026) : plus « attendues » chez elle.
    prisma.establishmentDocumentTypeExclusion.findMany({
      where: { establishmentId: { in: targets.map((t) => t.id) } },
      select: { establishmentId: true, documentTypeId: true },
    }),
  ]);

  for (const target of targets) {
    const hidden = new Set(
      exclusions.filter((e) => e.establishmentId === target.id).map((e) => e.documentTypeId)
    );
    const sources = criteria
      .filter((c) => isCriterionApplicable(c.applicableTo, target.type))
      .map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        chapterNumber: c.objective.theme.chapter.number,
        isImperative: isCriterionImperativeForEstablishment(c, target.type),
        expectedDocumentTypeIds: withoutHiddenTypes(
          c.documentTypes.map((d) => d.documentTypeId),
          hidden
        ),
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
                versionByCabinet: d.currentVersion != null && d.currentVersion.uploadedBy.role !== "CLIENT_USER",
                notApplicable: d.status === "NOT_APPLICABLE",
              },
            ]
          : []
      );
    result.set(target.id, buildCriteriaProofRows(sources, docs, target.mode));
  }
  return result;
}
