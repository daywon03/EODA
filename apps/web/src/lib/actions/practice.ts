"use server";

import { NEED } from "@/lib/auth/capabilities";
import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { readDiagnostic } from "@/lib/db/read-diagnostic";
import { PRACTICE_QUESTIONNAIRE } from "@/content/pratiques/questions";
import {
  describeLinkedDocuments,
  describePracticeProgress,
  latestAnswersByCriterion,
  parsePracticeAnswer,
  resolvePracticeQuestions,
  validatePracticeText,
  type PracticeAnswerFacts,
  type ResolvedPracticeQuestion,
} from "@/lib/services/practice-service";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS SUR LES PRATIQUES — lecture et enregistrement (tranche N7).
//
// Côté STRUCTURE seulement, sur SA structure (lien EstablishmentUser — aucun
// identifiant d'établissement reçu). Le critère reçu, lui, est une entrée non fiable :
// il doit être un impératif de CETTE structure, sinon introuvable. La version de la
// question est relue côté serveur, jamais reçue du navigateur.
// ─────────────────────────────────────────────────────────────────────────────

export type PracticeQuestionView = ResolvedPracticeQuestion & {
  linkedDocuments: string;
  current: PracticeAnswerFacts | null;
  // Réponse donnée sous une formulation antérieure : à revoir.
  outdated: boolean;
};

export type ClientPractices = {
  questions: PracticeQuestionView[];
  progress: { answered: number; total: number; label: string };
  provisional: boolean;
  questionnaireVersion: string;
  canAnswer: boolean;
};

async function loadPractices(establishmentId: string) {
  const data = await readDiagnostic(establishmentId);
  if (!data) return null;
  const imperatives = data.rows.filter((r) => r.isImperative);
  const questions = resolvePracticeQuestions(imperatives, PRACTICE_QUESTIONNAIRE);
  return { data, imperatives, questions };
}

export async function getClientPractices(): Promise<ClientPractices | null> {
  const { establishment, missionAccess } = await requireClientEstablishment(NEED.DIAGNOSTIC_READ);
  if (!establishment) return null;
  const loaded = await loadPractices(establishment.id);
  if (!loaded) return null;

  const [answers, documentTypes] = await Promise.all([
    prisma.practiceAnswer.findMany({
      where: { establishmentId: establishment.id },
      select: { criterionId: true, questionVersion: true, answer: true, text: true, answeredAt: true },
    }),
    prisma.documentType.findMany({
      where: { id: { in: [...new Set(loaded.imperatives.flatMap((r) => r.expectedDocumentTypeIds))] } },
      select: { id: true, label: true },
    }),
  ]);
  const latest = latestAnswersByCriterion(answers);
  const labels = new Map(documentTypes.map((t) => [t.id, t.label]));
  const byId = new Map(loaded.imperatives.map((r) => [r.id, r]));

  return {
    questions: loaded.questions.map((q) => {
      const current = latest.get(q.criterionId) ?? null;
      return {
        ...q,
        linkedDocuments: describeLinkedDocuments(byId.get(q.criterionId)!, labels),
        current,
        outdated: current !== null && current.questionVersion !== q.version,
      };
    }),
    progress: describePracticeProgress(loaded.questions, latest),
    provisional: PRACTICE_QUESTIONNAIRE.provisional,
    questionnaireVersion: PRACTICE_QUESTIONNAIRE.version,
    canAnswer: canDepositDocuments(missionAccess),
  };
}

export async function savePracticeAnswer(input: {
  criterionId: unknown;
  answer: unknown;
  text: unknown;
}): Promise<{ error: string } | null> {
  const { userId, session, establishment, missionAccess } = await requireClientEstablishment(NEED.DIAGNOSTIC_WRITE);
  if (!establishment) notFound();
  if (!canDepositDocuments(missionAccess)) {
    return { error: "L'accompagnement est terminé : vos réponses restent consultables, mais ne se modifient plus." };
  }

  const answer = parsePracticeAnswer(input.answer);
  if (!answer) return { error: "Choisissez une réponse : Oui, En partie, Pas encore ou Je ne sais pas." };
  const text = validatePracticeText(input.text);
  if (!text.ok) return { error: text.error };
  if (typeof input.criterionId !== "string") notFound();

  const loaded = await loadPractices(establishment.id);
  const question = loaded?.questions.find((q) => q.criterionId === input.criterionId);
  // Un critère qui n'est pas un impératif de CETTE structure : introuvable.
  if (!question) notFound();

  await prisma.practiceAnswer.create({
    data: {
      establishmentId: establishment.id,
      criterionId: question.criterionId,
      questionVersion: question.version,
      answer,
      text: text.text,
      answeredById: userId,
    },
  });
  // Le journal porte le critère et la réponse, JAMAIS le texte libre (il peut
  // évoquer une situation de personne accompagnée).
  await recordAuditEvent({
    action: "PRACTICE_ANSWER_SAVED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: establishment.id,
    targetId: question.criterionId,
    detail: `${question.criterionCode} → ${answer}`,
  });
  revalidatePath("/dashboard/client/diagnostic");
  revalidatePath("/dashboard/client/diagnostic/pratiques");
  return null;
}
