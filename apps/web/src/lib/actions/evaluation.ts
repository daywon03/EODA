"use server";

import { prisma, Rating } from "@eoda/database";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { isEnumValue } from "@/lib/validation/form-parsers";
import { revalidatePath } from "next/cache";
import { getOfferScope, isCriterionLevelCovered } from "@/lib/services/offer-scope-service";
import {
  computeCriterionScore,
  computeWeightedAverage,
  isRatingAllowed,
  type RatingAllowedResult,
} from "@/lib/services/scoring-service";
import { shouldSuggestCompliance } from "@/lib/services/pre-rating-suggestion-service";
import type { DocumentStatus } from "@eoda/database";

// L'autorisation (session Cabinet + appartenance de l'établissement au tenant) est
// entièrement portée par lib/auth/guards.ts — cf. le helper local supprimé ici, qui
// retombait sur une requête non filtrée quand l'utilisateur n'avait pas de tenant.

// Vérifie qu'une session d'évaluation appartient bien à un établissement du tenant
// de l'appelant. Indispensable pour toute action qui ne reçoit qu'un `sessionId` :
// sans ce contrôle, un identifiant deviné permet de coter l'établissement d'un
// autre cabinet.
async function requireEvaluationSessionInTenant(evaluationSessionId: string) {
  const { tenantId, session } = await requireCabinetSession();

  const evaluationSession = await prisma.evaluationSession.findFirst({
    where: { id: evaluationSessionId, establishment: { tenantId } },
    include: { chapter: true },
  });
  if (!evaluationSession) notFound();

  return { evaluationSession, session, tenantId };
}

const MAX_RATING_COMMENT_LENGTH = 4000;

// Message unique de refus de périmètre — ne révèle ni l'offre souscrite, ni ce que
// couvriraient les autres offres.
const OUT_OF_SCOPE_ERROR =
  "Ce critère n'entre pas dans le périmètre de l'offre souscrite pour cet établissement.";

function evaluationPaths(establishmentId: string, chapterNumber?: number) {
  const paths = [`/dashboard/cabinet/etablissements/${establishmentId}/evaluation`];
  if (chapterNumber) paths.push(`${paths[0]}/chapitre/${chapterNumber}`);
  return paths;
}

// État de session d'un chapitre, tel que l'écran de cotation en a besoin.
//
// ⚠️ Une session n'est PLUS créée à l'ouverture de la page. Elle l'était, et la
// conséquence n'était visible qu'après avoir cloturé une session : rouvrir le
// chapitre créait aussitôt une session vide, l'écran lisant toujours la plus
// récente, toutes les cotations disparaissaient. Sandrine aurait conclu à une perte
// de données — et c'est exactement le scénario de la SECONDE auto-évaluation
// promise en offre Excellence (§12.6).
//
// Désormais : la page reprend la session OUVERTE s'il y en a une, sinon elle montre
// la dernière session clôturée en lecture, et l'ouverture d'une nouvelle session est
// un geste explicite.
export type ChapterSessionState =
  | { kind: "OPEN"; sessionId: string; startedAt: Date }
  | { kind: "CLOSED"; startedAt: Date; finishedAt: Date; sessionCount: number }
  | { kind: "NONE" };

export async function getChapterSessionState(
  establishmentId: string,
  chapterId: string
): Promise<ChapterSessionState> {
  await requireEstablishmentInTenant(establishmentId);

  const latest = await prisma.evaluationSession.findFirst({
    where: { establishmentId, chapterId },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true, finishedAt: true },
  });
  if (!latest) return { kind: "NONE" };
  if (latest.finishedAt === null) {
    return { kind: "OPEN", sessionId: latest.id, startedAt: latest.startedAt };
  }

  const sessionCount = await prisma.evaluationSession.count({
    where: { establishmentId, chapterId },
  });
  return {
    kind: "CLOSED",
    startedAt: latest.startedAt,
    finishedAt: latest.finishedAt,
    sessionCount,
  };
}

// Ouverture d'une session : reprend celle qui est ouverte, ou en crée une. Appelée
// par un BOUTON, jamais par le rendu d'une page — c'est cette différence qui protège
// les cotations de la session précédente.
export async function startOrResumeEvaluationSession(
  establishmentId: string,
  chapterId: string
): Promise<{ sessionId: string; startedAt: Date }> {
  const { userId } = await requireEstablishmentInTenant(establishmentId);

  // Le chapitre doit exister dans le référentiel — un identifiant arbitraire ne doit
  // pas produire une session orpheline (erreur de contrainte technique côté client).
  const chapter = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { id: true } });
  if (!chapter) notFound();

  const existing = await prisma.evaluationSession.findFirst({
    where: { establishmentId, chapterId, finishedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return { sessionId: existing.id, startedAt: existing.startedAt };

  const created = await prisma.evaluationSession.create({
    data: { establishmentId, chapterId, performedByUserId: userId },
  });
  return { sessionId: created.id, startedAt: created.startedAt };
}

// Version appelable depuis un formulaire : la page se recharge sur la session
// ouverte. Le `void` est volontaire — l'écran n'a rien à faire de l'identifiant, il
// le relira par `getChapterSessionState`.
export async function openEvaluationSession(
  establishmentId: string,
  chapterId: string,
  chapterNumber: number
): Promise<void> {
  await startOrResumeEvaluationSession(establishmentId, chapterId);
  for (const path of evaluationPaths(establishmentId, chapterNumber)) revalidatePath(path);
}

export async function rateElement(
  sessionId: string,
  evaluationElementId: string,
  rating: Rating,
  comment: string | null
): Promise<{ error: string; warning?: string } | { warning?: string }> {
  if (!isEnumValue(rating, Rating)) return { error: "Cotation invalide." };

  const { evaluationSession } = await requireEvaluationSessionInTenant(sessionId);

  // Une session clôturée ne se cote plus. Elle est la PHOTO d'un état à une date :
  // la réécrire ferait dériver la première auto-évaluation à mesure qu'on avance
  // dans la seconde, et la comparaison des deux ne voudrait plus rien dire. Le
  // contrôle est ici, dans l'action — l'écran ne propose déjà pas les boutons, mais
  // `sessionId` vient d'une route HTTP publique.
  if (evaluationSession.finishedAt !== null) {
    return { error: "Cette session est clôturée. Ouvrez une nouvelle session pour coter." };
  }

  const element = await prisma.evaluationElement.findUnique({
    where: { id: evaluationElementId },
    include: { criterion: true },
  });
  if (!element) notFound();

  // Le périmètre de critères de l'offre s'applique à l'ÉCRITURE comme à la lecture.
  // getEvaluationChapter() n'affiche que les impératifs en Essentiel, mais
  // `evaluationElementId` vient d'une route HTTP publique, pas de l'UI : sans ce
  // contrôle, un élément d'un critère standard resterait cotable hors périmètre.
  // Sans mission, rien n'est contracté — même règle qu'à la lecture, où l'écran
  // renvoie missionRequired : la cotation est alors refusée.
  const mission = await prisma.mission.findUnique({
    where: { establishmentId: evaluationSession.establishmentId },
    select: { formule: true, gratuit: true },
  });
  if (!mission) return { error: OUT_OF_SCOPE_ERROR };
  if (!isCriterionLevelCovered(mission.formule, mission.gratuit, element.criterion.requirementLevel)) {
    return { error: OUT_OF_SCOPE_ERROR };
  }

  const check: RatingAllowedResult = isRatingAllowed(
    rating,
    evaluationSession.chapter.number,
    element.criterion.requirementLevel
  );
  if (!check.allowed) return { error: check.warning ?? "Cotation non autorisée." };

  // Commentaire = preuve consultée, saisi à chaud pendant l'entretien : borné pour
  // éviter qu'un champ libre serve de vecteur de saturation du stockage.
  const boundedComment = comment?.slice(0, MAX_RATING_COMMENT_LENGTH) ?? null;

  await prisma.elementRating.upsert({
    where: { evaluationSessionId_evaluationElementId: { evaluationSessionId: sessionId, evaluationElementId } },
    update: { rating, comment: boundedComment, confirmedByUser: true, suggestedBySystem: false },
    create: {
      evaluationSessionId: sessionId,
      evaluationElementId,
      rating,
      comment: boundedComment,
      confirmedByUser: true,
    },
  });

  revalidatePath(`/dashboard/cabinet/etablissements/${evaluationSession.establishmentId}/evaluation/chapitre/${evaluationSession.chapter.number}`);
  return check.warning ? { warning: check.warning } : {};
}

export async function finishEvaluationSession(sessionId: string): Promise<void> {
  const { evaluationSession } = await requireEvaluationSessionInTenant(sessionId);

  // Déjà clôturée : ne rien réécrire. Sinon un second clic repousserait `finishedAt`
  // et gonflerait la durée de séance d'un temps où personne ne travaillait.
  if (evaluationSession.finishedAt !== null) return;

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
