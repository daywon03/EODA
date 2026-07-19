"use server";

import { prisma, type Rating } from "@eoda/database";
import { requireCabinetSession } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getOfferScope } from "@/lib/services/offer-scope-service";
import {
  computeCriterionScore,
  computeWeightedAverage,
  isRatingAllowed,
  type RatingAllowedResult,
} from "@/lib/services/scoring-service";
import { shouldSuggestCompliance } from "@/lib/services/pre-rating-suggestion-service";
import type { DocumentStatus } from "@eoda/database";

async function requireEstablishmentInTenant(establishmentId: string) {
  const session = await requireCabinetSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  const establishment = await prisma.establishment.findFirst({
    where: user.tenantId ? { id: establishmentId, tenantId: user.tenantId } : { id: establishmentId },
  });
  if (!establishment) notFound();

  return { session, establishment };
}

function evaluationPaths(establishmentId: string, chapterNumber?: number) {
  const paths = [`/dashboard/cabinet/etablissements/${establishmentId}/evaluation`];
  if (chapterNumber) paths.push(`${paths[0]}/chapitre/${chapterNumber}`);
  return paths;
}

export async function startOrResumeEvaluationSession(
  establishmentId: string,
  chapterId: string
): Promise<{ sessionId: string; startedAt: Date }> {
  const { session } = await requireEstablishmentInTenant(establishmentId);

  const existing = await prisma.evaluationSession.findFirst({
    where: { establishmentId, chapterId, finishedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return { sessionId: existing.id, startedAt: existing.startedAt };

  const created = await prisma.evaluationSession.create({
    data: { establishmentId, chapterId, performedByUserId: session.user.id },
  });
  return { sessionId: created.id, startedAt: created.startedAt };
}

export async function rateElement(
  sessionId: string,
  evaluationElementId: string,
  rating: Rating,
  comment: string | null
): Promise<{ error: string; warning?: string } | { warning?: string }> {
  await requireCabinetSession();

  const evaluationSession = await prisma.evaluationSession.findUnique({
    where: { id: sessionId },
    include: { chapter: true },
  });
  if (!evaluationSession) notFound();

  const element = await prisma.evaluationElement.findUnique({
    where: { id: evaluationElementId },
    include: { criterion: true },
  });
  if (!element) notFound();

  const check: RatingAllowedResult = isRatingAllowed(
    rating,
    evaluationSession.chapter.number,
    element.criterion.requirementLevel
  );
  if (!check.allowed) return { error: check.warning ?? "Cotation non autorisée." };

  await prisma.elementRating.upsert({
    where: { evaluationSessionId_evaluationElementId: { evaluationSessionId: sessionId, evaluationElementId } },
    update: { rating, comment, confirmedByUser: true, suggestedBySystem: false },
    create: {
      evaluationSessionId: sessionId,
      evaluationElementId,
      rating,
      comment,
      confirmedByUser: true,
    },
  });

  revalidatePath(`/dashboard/cabinet/etablissements/${evaluationSession.establishmentId}/evaluation/chapitre/${evaluationSession.chapter.number}`);
  return check.warning ? { warning: check.warning } : {};
}

export async function finishEvaluationSession(sessionId: string): Promise<void> {
  await requireCabinetSession();

  const evaluationSession = await prisma.evaluationSession.findUnique({ where: { id: sessionId } });
  if (!evaluationSession) notFound();

  const durationSeconds = Math.round((Date.now() - evaluationSession.startedAt.getTime()) / 1000);

  await prisma.evaluationSession.update({
    where: { id: sessionId },
    data: { finishedAt: new Date(), durationSeconds },
  });

  for (const path of evaluationPaths(evaluationSession.establishmentId)) revalidatePath(path);
}

export type EvaluationElementView = {
  id: string;
  originalText: string;
  reformulatedText: string | null;
  allowsRi: boolean;
  rating: Rating | null;
  comment: string | null;
  suggestedBySystem: boolean;
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
    };
  }

  const offerScope = getOfferScope(mission.formule);

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
    include: { elementRatings: true },
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
  };
}

export async function listChapters() {
  await requireCabinetSession();
  return prisma.chapter.findMany({ orderBy: { number: "asc" } });
}
