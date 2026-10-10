"use server";

import { prisma, Rating } from "@eoda/database";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { isEnumValue } from "@/lib/validation/form-parsers";
import { revalidatePath } from "next/cache";
import { isCriterionLevelCovered } from "@/lib/services/offer-scope-service";
import { isRatingAllowed, type RatingAllowedResult } from "@/lib/services/scoring-service";

// La LECTURE de l'arbre de cotation vit dans evaluation-chapter.ts.

// L'autorisation (session Cabinet + appartenance de l'établissement au tenant) est
// entièrement portée par lib/auth/guards.ts — cf. le helper local supprimé ici, qui
// retombait sur une requête non filtrée quand l'utilisateur n'avait pas de tenant.

// Vérifie qu'une session d'évaluation appartient bien à un établissement du tenant
// de l'appelant. Indispensable pour toute action qui ne reçoit qu'un `sessionId` :
// sans ce contrôle, un identifiant deviné permet de coter l'établissement d'un
// autre cabinet.
async function requireEvaluationSessionInTenant(evaluationSessionId: string) {
  const { tenantId, session, userId } = await requireCabinetSession();

  const evaluationSession = await prisma.evaluationSession.findFirst({
    where: { id: evaluationSessionId, establishment: { tenantId } },
    include: { chapter: true },
  });
  if (!evaluationSession) notFound();

  return { evaluationSession, session, tenantId, userId };
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

  const { evaluationSession, userId } = await requireEvaluationSessionInTenant(sessionId);

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
    // Chaque écriture est un GESTE humain : auteur et date suivent le dernier geste
    // (« Coté par {nom} · date »). `ratedAt` n'était posé qu'à la création.
    update: {
      rating,
      comment: boundedComment,
      confirmedByUser: true,
      suggestedBySystem: false,
      ratedByUserId: userId,
      ratedAt: new Date(),
    },
    create: {
      evaluationSessionId: sessionId,
      evaluationElementId,
      rating,
      comment: boundedComment,
      confirmedByUser: true,
      ratedByUserId: userId,
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

