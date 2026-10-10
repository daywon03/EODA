"use server";

import { prisma, type DocumentStatus, type Rating } from "@eoda/database";
import { notFound } from "next/navigation";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getOfferScope } from "@/lib/services/offer-scope-service";
import { computeCriterionScore, computeWeightedAverage } from "@/lib/services/scoring-service";
import { shouldSuggestCompliance } from "@/lib/services/pre-rating-suggestion-service";

// LECTURE de l'auto-évaluation (arbre chapitre → thème → objectif → critère →
// élément), séparée des gestes d'écriture (evaluation.ts) le 10/10/2026 pour garder
// des fichiers de taille humaine. Même garde : requireEstablishmentInTenant.

export type EvaluationElementView = {
  id: string;
  originalText: string;
  reformulatedText: string | null;
  allowsRi: boolean;
  rating: Rating | null;
  comment: string | null;
  suggestedBySystem: boolean;
  confirmedByUser: boolean;
  ratedAt: Date | null;
  ratedByName: string | null;
};

export type EvaluationCriterionView = {
  id: string;
  code: string;
  label: string;
  requirementLevel: "IMPERATIF" | "STANDARD";
  score: number | null;
  elements: EvaluationElementView[];
};

export type EvaluationObjectiveView = {
  id: string;
  code: string;
  score: number | null;
  criteria: EvaluationCriterionView[];
};

export type EvaluationThemeView = {
  id: string;
  code: string;
  name: string;
  score: number | null;
  objectives: EvaluationObjectiveView[];
};

export type EvaluationChapterData = {
  chapter: { id: string; number: number; name: string; method: string };
  themes: EvaluationThemeView[];
  chapterScore: number | null;
  sessionId: string | null;
  imperatifsAtRisk: { code: string; label: string; score: number | null }[];
  missionRequired: boolean;
  // Offre restreinte aux critères impératifs (Essentiel) : le périmètre affiché le dit.
  imperativesOnly: boolean;
};

export async function getEvaluationChapter(
  establishmentId: string,
  chapterNumber: number
): Promise<EvaluationChapterData> {
  await requireEstablishmentInTenant(establishmentId);

  const mission = await prisma.mission.findUnique({ where: { establishmentId } });
  if (!mission) {
    return {
      chapter: { id: "", number: chapterNumber, name: "", method: "" },
      themes: [],
      chapterScore: null,
      sessionId: null,
      imperatifsAtRisk: [],
      missionRequired: true,
      imperativesOnly: false,
    };
  }

  // `gratuit` fait partie du périmètre (§7.5) : une mission bêta-test gratuite reçoit
  // l'Excellence complète, y compris sur les critères cotables.
  const offerScope = getOfferScope(mission.formule, mission.gratuit);

  const chapter = await prisma.chapter.findFirst({
    where: { number: chapterNumber },
    include: {
      themes: {
        orderBy: { code: "asc" },
        include: {
          objectives: {
            orderBy: { code: "asc" },
            include: {
              criteria: {
                orderBy: { code: "asc" },
                where: offerScope.criteriaScope === "IMPERATIFS_ONLY" ? { requirementLevel: "IMPERATIF" } : {},
                include: { evaluationElements: true },
              },
            },
          },
        },
      },
    },
  });
  if (!chapter) notFound();

  const activeSession = await prisma.evaluationSession.findFirst({
    where: { establishmentId, chapterId: chapter.id },
    orderBy: { startedAt: "desc" },
    include: { elementRatings: { include: { ratedBy: { select: { name: true } } } } },
  });

  const ratingByElementId = new Map(
    (activeSession?.elementRatings ?? []).map((r) => [r.evaluationElementId, r])
  );

  // Pont Module 1 → Module 3 : critères dont TOUS les documents rattachés sont
  // conformes reçoivent une suggestion de cotation 4, jamais persistée tant que
  // l'évaluateur ne clique pas — cf. pre-rating-suggestion-service.ts.
  const criterionIds = chapter.themes.flatMap((t) => t.objectives.flatMap((o) => o.criteria.map((c) => c.id)));
  const linkedDocTypes = await prisma.documentTypeCriterion.findMany({
    where: { criterionId: { in: criterionIds } },
  });
  const documents = await prisma.document.findMany({
    where: { establishmentId, documentTypeId: { in: linkedDocTypes.map((l) => l.documentTypeId) } },
    select: { documentTypeId: true, status: true },
  });
  const statusByDocTypeId = new Map(documents.map((d) => [d.documentTypeId, d.status]));
  const docTypeIdsByCriterionId = new Map<string, string[]>();
  for (const link of linkedDocTypes) {
    const list = docTypeIdsByCriterionId.get(link.criterionId) ?? [];
    list.push(link.documentTypeId);
    docTypeIdsByCriterionId.set(link.criterionId, list);
  }
  const suggestedCriterionIds = new Set(
    criterionIds.filter((cid) => {
      const docTypeIds = docTypeIdsByCriterionId.get(cid) ?? [];
      const statuses: DocumentStatus[] = docTypeIds.map((id) => statusByDocTypeId.get(id) ?? "MISSING");
      return shouldSuggestCompliance(statuses);
    })
  );

  const imperatifsAtRisk: EvaluationChapterData["imperatifsAtRisk"] = [];

  const themes: EvaluationThemeView[] = chapter.themes
    .filter((t) => t.objectives.some((o) => o.criteria.length > 0))
    .map((theme) => {
      const objectives: EvaluationObjectiveView[] = theme.objectives
        .filter((o) => o.criteria.length > 0)
        .map((objective) => {
          const criteria: EvaluationCriterionView[] = objective.criteria.map((criterion) => {
            const elements: EvaluationElementView[] = criterion.evaluationElements.map((ee) => {
              const r = ratingByElementId.get(ee.id);
              return {
                id: ee.id,
                originalText: ee.originalText,
                reformulatedText: ee.reformulatedText,
                allowsRi: ee.allowsRi,
                rating: r?.rating ?? null,
                comment: r?.comment ?? null,
                // Suggestion virtuelle (jamais persistée, jamais appliquée sans clic de
                // l'évaluateur) tant qu'aucune cotation confirmée n'existe déjà.
                suggestedBySystem: r?.suggestedBySystem ?? (!r && suggestedCriterionIds.has(criterion.id)),
                confirmedByUser: r?.confirmedByUser ?? false,
                ratedAt: r?.ratedAt ?? null,
                ratedByName: r?.ratedBy?.name ?? null,
              };
            });
            const score = computeCriterionScore(elements.map((e) => e.rating).filter((r): r is Rating => r !== null));

            if (criterion.requirementLevel === "IMPERATIF" && score !== null && score < 4) {
              imperatifsAtRisk.push({ code: criterion.code, label: criterion.label, score });
            }

            return {
              id: criterion.id,
              code: criterion.code,
              label: criterion.label,
              requirementLevel: criterion.requirementLevel,
              score,
              elements,
            };
          });

          const score = computeWeightedAverage(criteria.map((c) => ({ score: c.score })));
          return { id: objective.id, code: objective.code, score, criteria };
        });

      const score = computeWeightedAverage(objectives.map((o) => ({ score: o.score })));
      return { id: theme.id, code: theme.code, name: theme.name, score, objectives };
    });

  const chapterScore = computeWeightedAverage(themes.map((t) => ({ score: t.score })));

  return {
    chapter: { id: chapter.id, number: chapter.number, name: chapter.name, method: chapter.method },
    themes,
    chapterScore,
    sessionId: activeSession?.id ?? null,
    imperatifsAtRisk,
    missionRequired: false,
    imperativesOnly: offerScope.criteriaScope === "IMPERATIFS_ONLY",
  };
}

export async function listChapters() {
  await requireCabinetSession();
  return prisma.chapter.findMany({ orderBy: { number: "asc" } });
}
