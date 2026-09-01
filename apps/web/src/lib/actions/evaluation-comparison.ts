"use server";

import { prisma, type Rating } from "@eoda/database";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getOfferScope } from "@/lib/services/offer-scope-service";
import {
  compareCriteria,
  sortForReview,
  summariseComparison,
  type ComparisonSummary,
  type CriterionComparison,
} from "@/lib/services/evaluation-comparison-service";

// ─────────────────────────────────────────────────────────────────────────────
// COMPARAISON DE DEUX SESSIONS D'AUTO-ÉVALUATION — lecture seule.
//
// Les deux sessions comparées sont les DEUX DERNIÈRES du chapitre, dans l'ordre où
// elles ont commencé. Pas de sélecteur de session : la question posée en réunion est
// « où en est-on par rapport à la dernière fois », et un menu à trois entrées ne la
// pose pas mieux.
//
// Le périmètre de critères suit l'offre (`offer-scope-service`), comme l'écran de
// cotation : comparer des critères hors offre montrerait des lignes vides que
// personne n'a jamais eu le droit de coter.
// ─────────────────────────────────────────────────────────────────────────────

export type ChapterComparison = {
  chapterNumber: number;
  chapterName: string;
  previousStartedAt: Date;
  currentStartedAt: Date;
  comparisons: CriterionComparison[];
  summary: ComparisonSummary;
};

export type EvaluationComparisonResult = {
  chapters: ChapterComparison[];
  // Chapitres qui n'ont qu'une seule session : il n'y a rien à comparer, et le dire
  // vaut mieux qu'une page vide (« la deuxième auto-évaluation n'a pas eu lieu »).
  chaptersWithSingleSession: number[];
};

export async function getEvaluationComparison(
  establishmentId: string
): Promise<EvaluationComparisonResult> {
  // Garde unique : identité + appartenance au tenant.
  await requireEstablishmentInTenant(establishmentId);

  const mission = await prisma.mission.findUnique({
    where: { establishmentId },
    select: { formule: true, gratuit: true },
  });
  // Sans mission, aucun périmètre n'est contracté — même règle qu'à la cotation.
  if (!mission) return { chapters: [], chaptersWithSingleSession: [] };

  const offerScope = getOfferScope(mission.formule, mission.gratuit);

  const sessions = await prisma.evaluationSession.findMany({
    where: { establishmentId },
    orderBy: { startedAt: "asc" },
    select: {
      id: true,
      startedAt: true,
      chapter: { select: { id: true, number: true, name: true } },
      elementRatings: { select: { evaluationElementId: true, rating: true } },
    },
  });
  if (sessions.length === 0) return { chapters: [], chaptersWithSingleSession: [] };

  // Critères du périmètre, avec leurs éléments : c'est ce qui permet de regrouper des
  // cotations d'éléments en score de critère.
  const criteria = await prisma.criterion.findMany({
    where: offerScope.criteriaScope === "IMPERATIFS_ONLY" ? { requirementLevel: "IMPERATIF" } : {},
    select: {
      code: true,
      label: true,
      requirementLevel: true,
      evaluationElements: { select: { id: true } },
      objective: { select: { theme: { select: { chapterId: true } } } },
    },
    orderBy: { code: "asc" },
  });

  const chapters: ChapterComparison[] = [];
  const chaptersWithSingleSession: number[] = [];

  const byChapterId = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const bucket = byChapterId.get(session.chapter.id) ?? [];
    bucket.push(session);
    byChapterId.set(session.chapter.id, bucket);
  }

  for (const [chapterId, chapterSessions] of byChapterId) {
    const current = chapterSessions[chapterSessions.length - 1];
    const previous = chapterSessions[chapterSessions.length - 2];
    if (!current) continue;

    if (!previous) {
      chaptersWithSingleSession.push(current.chapter.number);
      continue;
    }

    const ratingOf = (session: (typeof sessions)[number]) =>
      new Map<string, Rating>(
        session.elementRatings.map((rating) => [rating.evaluationElementId, rating.rating])
      );
    const previousRatings = ratingOf(previous);
    const currentRatings = ratingOf(current);

    const chapterCriteria = criteria.filter(
      (criterion) => criterion.objective.theme.chapterId === chapterId
    );

    const comparisons = compareCriteria(
      chapterCriteria.map((criterion) => {
        const elementIds = criterion.evaluationElements.map((element) => element.id);
        const collect = (source: Map<string, Rating>) =>
          elementIds
            .map((id) => source.get(id))
            .filter((rating): rating is Rating => rating !== undefined);

        return {
          code: criterion.code,
          label: criterion.label,
          requirementLevel: criterion.requirementLevel,
          previousRatings: collect(previousRatings),
          currentRatings: collect(currentRatings),
        };
      })
    );

    chapters.push({
      chapterNumber: current.chapter.number,
      chapterName: current.chapter.name,
      previousStartedAt: previous.startedAt,
      currentStartedAt: current.startedAt,
      comparisons: sortForReview(comparisons),
      summary: summariseComparison(comparisons),
    });
  }

  chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  chaptersWithSingleSession.sort((a, b) => a - b);

  return { chapters, chaptersWithSingleSession };
}
