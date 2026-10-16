import { prisma, type EstablishmentType, type Rating } from "@eoda/database";
import { computeCriterionScore } from "@/lib/services/scoring-service";
import { applicableToValuesFor } from "@/lib/services/criterion-applicability-service";
import { isCriterionImperativeForEstablishment } from "@/lib/services/criterion-imperativeness-service";
import type { PacCriterionInput } from "@/lib/services/pac-proposal-service";

// ─────────────────────────────────────────────────────────────────────────────
// Entrées du PAC pour UNE structure déjà gardée par l'appelant : score de chaque
// critère dans la DERNIÈRE session de son chapitre (« table rase » : régénéré depuis
// le diagnostic, pas depuis l'historique), et documents attendus (matrice validée).
// Une cotation proposée par la plateforme et non confirmée ne compte pas : seul un
// geste humain fait un score.
// ─────────────────────────────────────────────────────────────────────────────

export async function readPacInputs(
  establishmentId: string,
  establishmentType: EstablishmentType
): Promise<PacCriterionInput[]> {
  const [sessions, criteria, documents] = await Promise.all([
    prisma.evaluationSession.findMany({
      where: { establishmentId },
      orderBy: { startedAt: "desc" },
      select: {
        chapterId: true,
        elementRatings: {
          select: {
            rating: true,
            suggestedBySystem: true,
            confirmedByUser: true,
            evaluationElement: { select: { criterionId: true } },
          },
        },
      },
    }),
    prisma.criterion.findMany({
      where: { applicableTo: { in: applicableToValuesFor(establishmentType) } },
      select: {
        id: true,
        code: true,
        label: true,
        requirementLevel: true,
        documentTypes: { select: { documentTypeId: true, documentType: { select: { label: true } } } },
      },
    }),
    prisma.document.findMany({
      where: { establishmentId, documentTypeId: { not: null } },
      select: { id: true, documentTypeId: true, currentVersionId: true },
    }),
  ]);

  // Dernière session de chaque chapitre seulement.
  const seenChapters = new Set<string>();
  const ratingsByCriterion = new Map<string, Rating[]>();
  for (const session of sessions) {
    if (seenChapters.has(session.chapterId)) continue;
    seenChapters.add(session.chapterId);
    for (const r of session.elementRatings) {
      if (r.suggestedBySystem && !r.confirmedByUser) continue;
      const list = ratingsByCriterion.get(r.evaluationElement.criterionId) ?? [];
      list.push(r.rating);
      ratingsByCriterion.set(r.evaluationElement.criterionId, list);
    }
  }

  const documentByType = new Map(documents.map((d) => [d.documentTypeId, d]));
  return criteria.map((c) => {
    const ratings = ratingsByCriterion.get(c.id) ?? [];
    return {
      criterionId: c.id,
      code: c.code,
      label: c.label,
      score: ratings.length === 0 ? null : computeCriterionScore(ratings),
      isImperative: isCriterionImperativeForEstablishment(c, establishmentType),
      documents: c.documentTypes.map((link) => {
        const doc = documentByType.get(link.documentTypeId);
        return {
          documentTypeLabel: link.documentType.label,
          documentId: doc?.id ?? null,
          deposited: Boolean(doc?.currentVersionId),
        };
      }),
    };
  });
}
