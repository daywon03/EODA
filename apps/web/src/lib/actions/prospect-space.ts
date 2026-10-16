"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProspectSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { PRACTICE_QUESTIONNAIRE } from "@/content/pratiques/questions";
import {
  isAnswerCurrent,
  parsePracticeAnswer,
  resolvePracticeQuestions,
  validatePracticeText,
  type PracticeAnswerFacts,
  type ResolvedPracticeQuestion,
} from "@/lib/services/practice-service";
import {
  buildWorkList,
  deriveDiagnosticProgress,
  momentLabelFor,
  validateCallRequest,
  type DiagnosticProgress,
  type WorkItem,
} from "@/lib/services/prospect-diagnostic-service";
import { readImperativesByType, readProspectAnswers, type ProspectImperative } from "@/lib/db/read-prospect-diagnostic";
import { getEmailPort } from "@/lib/email";
import { buildAccompanimentRequestEmail } from "@/lib/email/commercial-templates";
import { appUrl } from "@/lib/config/app-url";
import type { SelfServiceFormule } from "@/lib/services/self-service-service";

// ─────────────────────────────────────────────────────────────────────────────
// ESPACE D'UNE STRUCTURE INSCRITE SEULE (/espace) — D5, 13/10/2026.
//
// Toutes les actions passent par requireProspectSession() : le prospect vient du lien
// ProspectAccount de l'appelant, JAMAIS d'un identifiant reçu. Le critère reçu, lui,
// est une entrée non fiable : il doit être un impératif du profil de CE prospect.
// Aucun dépôt de document ici : les documents sont rattachés à un établissement, qui
// ne naît qu'à la signature (pas de seconde porte).
// ─────────────────────────────────────────────────────────────────────────────

const SPACE_PATH = "/espace";

export type ProspectQuestionView = ResolvedPracticeQuestion & {
  current: PracticeAnswerFacts | null;
  outdated: boolean;
};

export type ProspectSpace = {
  structureName: string;
  firstName: string;
  formule: SelfServiceFormule | null;
  hasProfile: boolean;
  signed: boolean;
  questions: ProspectQuestionView[];
  progress: DiagnosticProgress;
  workList: WorkItem[];
  pendingCall: { startsAt: Date; status: "DEMANDE" | "PROPOSE" | "CONFIRME" } | null;
  provisional: boolean;
};

async function loadQuestions(establishmentType: "SAD_AIDE" | "SAD_MIXTE" | null): Promise<{
  imperatives: ProspectImperative[];
  questions: ResolvedPracticeQuestion[];
}> {
  if (!establishmentType) return { imperatives: [], questions: [] };
  const imperatives = (await readImperativesByType())[establishmentType];
  return { imperatives, questions: resolvePracticeQuestions(imperatives, PRACTICE_QUESTIONNAIRE) };
}

function toFormule(value: string | null): SelfServiceFormule | null {
  return value === "ESSENTIEL" || value === "PERFORMANCE" || value === "EXCELLENCE" ? value : null;
}

export async function getProspectSpace(): Promise<ProspectSpace> {
  const { prospect, session } = await requireProspectSession();
  const [{ imperatives, questions }, answers, call] = await Promise.all([
    loadQuestions(prospect.establishmentType),
    readProspectAnswers([prospect.id]),
    prisma.appointment.findFirst({
      where: { prospectId: prospect.id, kind: "R1_DECOUVERTE", status: { in: ["DEMANDE", "PROPOSE", "CONFIRME"] }, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, status: true },
    }),
  ]);
  const latest = answers.get(prospect.id)?.latest ?? new Map<string, PracticeAnswerFacts>();
  const views = questions.map((q) => {
    const current = latest.get(q.criterionId) ?? null;
    return { ...q, current, outdated: current !== null && current.questionVersion !== q.version };
  });
  const answered = views.filter((q) => isAnswerCurrent(q.current ?? undefined, q)).length;

  return {
    structureName: prospect.structureName,
    firstName: session.user.name ?? "",
    formule: toFormule(prospect.envisagedFormule),
    hasProfile: prospect.establishmentType !== null,
    signed: prospect.establishmentId !== null,
    questions: views,
    progress: deriveDiagnosticProgress(answered, views.length),
    workList: buildWorkList(
      imperatives.map((c) => ({
        criterionId: c.id,
        criterionCode: c.code,
        answer: latest.get(c.id)?.answer ?? null,
        expectedDocuments: c.expectedDocuments,
      }))
    ),
    pendingCall: call && call.status !== "ANNULE" ? { startsAt: call.startsAt, status: call.status } : null,
    provisional: PRACTICE_QUESTIONNAIRE.provisional,
  };
}

export async function saveProspectPracticeAnswer(input: {
  criterionId: unknown;
  answer: unknown;
  text: unknown;
}): Promise<{ error: string } | null> {
  const { prospect, userId } = await requireProspectSession();
  const answer = parsePracticeAnswer(input.answer);
  if (!answer) return { error: "Choisissez une réponse : Oui, En partie, Pas encore ou Je ne sais pas." };
  const text = validatePracticeText(input.text);
  if (!text.ok) return { error: text.error };
  if (typeof input.criterionId !== "string") notFound();

  const { questions } = await loadQuestions(prospect.establishmentType);
  const question = questions.find((q) => q.criterionId === input.criterionId);
  // Un critère qui n'est pas un impératif du profil de CE prospect : introuvable.
  if (!question) notFound();

  await prisma.prospectPracticeAnswer.create({
    data: {
      prospectId: prospect.id,
      criterionId: question.criterionId,
      questionVersion: question.version,
      answer,
      text: text.text,
      answeredById: userId,
    },
  });
  // Le journal porte le critère et la réponse, jamais le texte libre.
  await recordAuditEvent({
    action: "PROSPECT_PRACTICE_ANSWERED",
    actorUserId: userId,
    actorRole: "PROSPECT_USER",
    targetId: prospect.id,
    detail: `${question.criterionCode} → ${answer}`,
  });
  revalidatePath(SPACE_PATH);
  return null;
}

export type AccompanimentState = { status: "IDLE" } | { status: "ERROR"; error: string } | { status: "DONE" };

// « Être accompagné » : un rendez-vous R1 (appel découverte) au statut DEMANDE, lié
// au prospect, et une alerte au cabinet par le port e-mail. Une seule demande ouverte
// à la fois : en refaire une remplace la préférence (l'ancienne est annulée).
export async function requestAccompaniment(_prev: AccompanimentState, formData: FormData): Promise<AccompanimentState> {
  const { prospect, userId } = await requireProspectSession();
  const checked = validateCallRequest(
    { day: formData.get("day"), moment: formData.get("moment"), message: formData.get("message") },
    new Date()
  );
  if (!checked.ok) return { status: "ERROR", error: checked.error };
  const request = checked.value;

  await prisma.$transaction(async (tx) => {
    await tx.appointment.updateMany({
      where: { prospectId: prospect.id, kind: "R1_DECOUVERTE", status: "DEMANDE" },
      data: { status: "ANNULE" },
    });
    await tx.appointment.create({
      data: {
        tenantId: prospect.tenantId,
        prospectId: prospect.id,
        kind: "R1_DECOUVERTE",
        mode: "TELEPHONE",
        status: "DEMANDE",
        startsAt: request.startsAt,
        endsAt: request.endsAt,
        subject: "Appel découverte — demandé par la structure",
        // Le message de la structure reste côté cabinet (notes), jamais dans l'e-mail.
        notes: request.message,
        createdByUserId: userId,
      },
    });
  });

  await recordAuditEvent({ action: "ACCOMPANIMENT_REQUESTED", actorUserId: userId, actorRole: "PROSPECT_USER", targetId: prospect.id });
  await notifyCabinet(prospect.tenantId, prospect.id, prospect.structureName, request.startsAt);
  revalidatePath(SPACE_PATH);
  return { status: "DONE" };
}

// Destinataires : les comptes actifs du cabinet qui ont le commercial (administration
// et commercial). Un envoi manqué ne défait pas la demande — elle est en base, et la
// vue d'ensemble commerciale la montre dans « À faire ».
async function notifyCabinet(tenantId: string, prospectId: string, structureName: string, day: Date): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ["CABINET_ADMIN", "CABINET_COMMERCIAL"] } },
    select: { email: true },
  });
  const content = buildAccompanimentRequestEmail({
    structureName,
    preferredDay: day,
    momentLabel: momentLabelFor(day),
    prospectUrl: appUrl(`/dashboard/cabinet/commercial/prospects/${prospectId}`),
    brand: { logoUrl: appUrl("/logo-eoda.png") },
  });
  for (const { email } of recipients) {
    try {
      await getEmailPort().send({ to: email, subject: content.subject, html: content.html });
    } catch (error) {
      console.error("Demande d'accompagnement — alerte au cabinet non envoyée :", error);
    }
  }
}
