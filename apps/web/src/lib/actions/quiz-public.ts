"use server";

import { prisma } from "@eoda/database";
import { headers } from "next/headers";
import { findQuizModule, type QuizModule, type QuizPictogram } from "@/content/quiz";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { clientIpFromHeaders } from "@/lib/security/login-throttle";
import type { RateLimitPolicy } from "@/lib/security/rate-limiter-port";
import {
  decideInvitationState,
  hashQuizToken,
  isQuizTokenWellFormed,
  quizTokenHashesMatch,
} from "@/lib/security/quiz-token";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { isComplete, scoreQuiz } from "@/lib/services/quiz-scoring-service";

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ PUBLIC — /quiz/[token] (N10). La SEULE route publique nouvelle.
//
// Aucune session : le jeton EST l'autorisation, et il n'ouvre qu'UNE chose — passer
// UN quiz, UNE fois, avant son échéance. Ce qui en sort est volontairement minimal :
// le nom de la structure (pour que la personne sache où elle est), le quiz SANS ses
// bonnes réponses. Aucun nom de salarié (un lien qui traîne ne dit pas à qui il
// était), aucune donnée de santé, rien d'autre de la structure.
//
// Entrée hostile (S8) : jeton au format vérifié AVANT toute lecture, limitation de
// débit par IP (RateLimitCounter partagé en production), empreinte comparée en
// temps constant, usage unique posé ATOMIQUEMENT (updateMany conditionnel), score
// calculé ici et jamais reçu du navigateur.
// ─────────────────────────────────────────────────────────────────────────────

const QUIZ_LINK_RATE_LIMIT: RateLimitPolicy = { limit: 40, windowSeconds: 15 * 60 };

type Refusal = { state: "INVALID" | "EXPIRED" | "USED" | "RATE_LIMITED" };

export type PublicQuestion = { id: string; prompt: string; choices: { id: string; label: string }[] };

export type PublicQuizView =
  | Refusal
  | {
      state: "VALID";
      establishmentName: string;
      quiz: { title: string; pictogram: QuizPictogram; questions: PublicQuestion[] };
    };

export type PublicQuizResult =
  | Refusal
  | { state: "INCOMPLETE" }
  | {
      state: "DONE";
      score: number;
      total: number;
      passed: boolean;
      corrections: { id: string; prompt: string; correctLabel: string; wasCorrect: boolean; explanation: string }[];
    };

async function throttle(): Promise<boolean> {
  const ip = clientIpFromHeaders(await headers());
  return consumeThrottledAttempt({ key: `quiz:${ip}`, policy: QUIZ_LINK_RATE_LIMIT, auditAction: "QUIZ_LINK_RATE_LIMITED" });
}

type ResolvedInvitation = {
  id: string;
  staffMemberId: string;
  expiresAt: Date;
  usedAt: Date | null;
  campaign: { tenantId: string; establishmentId: string; moduleCode: string; establishment: { name: string } };
};

async function resolveInvitation(token: unknown): Promise<Refusal | { invitation: ResolvedInvitation; quiz: QuizModule; token: string }> {
  if (!isQuizTokenWellFormed(token)) return { state: "INVALID" };
  if (!(await throttle())) return { state: "RATE_LIMITED" };
  const invitation = await prisma.quizInvitation.findUnique({
    where: { tokenHash: hashQuizToken(token) },
    select: {
      id: true,
      tokenHash: true,
      staffMemberId: true,
      expiresAt: true,
      usedAt: true,
      campaign: {
        select: { tenantId: true, establishmentId: true, moduleCode: true, establishment: { select: { name: true } } },
      },
    },
  });
  if (!invitation || !quizTokenHashesMatch(invitation.tokenHash, token)) return { state: "INVALID" };
  const quiz = findQuizModule(invitation.campaign.moduleCode);
  if (!quiz) return { state: "INVALID" };
  const state = decideInvitationState(invitation, new Date());
  if (state !== "VALID") return { state };
  return { invitation, quiz, token };
}

export async function openPublicQuiz(token: string): Promise<PublicQuizView> {
  const resolved = await resolveInvitation(token);
  if ("state" in resolved) return resolved;
  const { invitation, quiz } = resolved;
  return {
    state: "VALID",
    establishmentName: invitation.campaign.establishment.name,
    // Les bonnes réponses et les explications ne quittent PAS le serveur avant la fin.
    quiz: {
      title: quiz.title,
      pictogram: quiz.pictogram,
      questions: quiz.questions.map((q) => ({ id: q.id, prompt: q.prompt, choices: q.choices.map((c) => ({ ...c })) })),
    },
  };
}

export async function submitPublicQuiz(token: string, rawAnswers: unknown): Promise<PublicQuizResult> {
  const resolved = await resolveInvitation(token);
  if ("state" in resolved) return resolved;
  const { invitation, quiz } = resolved;
  const result = scoreQuiz(quiz, rawAnswers);
  if (!isComplete(quiz, result.answers)) return { state: "INCOMPLETE" };

  const now = new Date();
  const attemptId = await prisma.$transaction(async (tx) => {
    // Usage unique ATOMIQUE : deux envois simultanés du même lien, un seul passe.
    const claimed = await tx.quizInvitation.updateMany({
      where: { id: invitation.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;
    const attempt = await tx.quizAttempt.create({
      data: {
        tenantId: invitation.campaign.tenantId,
        establishmentId: invitation.campaign.establishmentId,
        staffMemberId: invitation.staffMemberId,
        invitationId: invitation.id,
        moduleCode: quiz.code,
        moduleVersion: quiz.version,
        score: result.score,
        total: result.total,
        passed: result.passed,
        answersJson: result.answers,
        completedAt: now,
      },
      select: { id: true },
    });
    return attempt.id;
  });
  if (!attemptId) return { state: "USED" };

  await recordAuditEvent({
    action: "QUIZ_ATTEMPT_COMPLETED",
    establishmentId: invitation.campaign.establishmentId,
    targetId: attemptId,
    detail: `${quiz.code} v${quiz.version} · ${result.passed ? "réussi" : "à refaire"}`,
  });

  return {
    state: "DONE",
    score: result.score,
    total: result.total,
    passed: result.passed,
    corrections: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      correctLabel: q.choices.find((c) => c.id === q.correctChoiceId)?.label ?? "",
      wasCorrect: result.answers[q.id] === q.correctChoiceId,
      explanation: q.explanation,
    })),
  };
}
