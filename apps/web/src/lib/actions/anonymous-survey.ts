"use server";

import { prisma } from "@eoda/database";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEstablishmentAccess, resolveTabletSession } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { findSurveyTemplate, SURVEY_SCALES, type SurveyTemplate } from "@/content/enquete";
import type { SurveyMode, SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";
import { consumeThrottledAttempt } from "@/lib/security/attempt-throttle";
import { clientIpFromHeaders } from "@/lib/security/login-throttle";
import type { RateLimitPolicy } from "@/lib/security/rate-limiter-port";
import {
  decideOneTimeTokenState,
  generateOneTimeToken,
  hashOneTimeToken,
  isOneTimeTokenWellFormed,
  oneTimeTokenExpiry,
  oneTimeTokenMatches,
} from "@/lib/security/one-time-token";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import {
  ANONYMOUS_SURVEY_LINK_TTL_HOURS,
  anonymousQuestions,
  completedOnFor,
  parseAnonymousAnswers,
  parseLinkCount,
  respondentKindFor,
  type AnonymousAnswer,
} from "@/lib/services/anonymous-survey-service";

// ─────────────────────────────────────────────────────────────────────────────
// ENQUÊTE DE SATISFACTION ANONYME (décision de Damon, 21/10/2026).
//
// HORS verrou HDS parce qu'elle ne contient, par construction, aucune donnée de
// personne : pas de nom, pas de lien vers un dossier, pas de texte libre, pas de
// salarié, la date au jour (cf. le schéma et anonymous-survey-schema.test.ts).
// Les réponses ne sont JAMAIS journalisées : l'heure et l'appareil d'une trace
// rattacheraient la réponse à une visite, donc à une personne.
//
// Trois portes, et trois seulement :
//   - la STRUCTURE crée des liens à usage unique (portail, TERRAIN_WRITE) ;
//   - un lien ouvre UNE enquête, UNE fois (/enquete/[jeton], débit limité par IP) ;
//   - la TABLETTE enregistrée, salarié connecté avec son code, envoie une enquête.
// ─────────────────────────────────────────────────────────────────────────────

const LINK_RATE_LIMIT: RateLimitPolicy = { limit: 40, windowSeconds: 15 * 60 };

export type AnonymousSurveyQuestionView = {
  id: string;
  prompt: string;
  help: string | null;
  // Numéro du questionnaire papier (« 12 A »), pour s'y retrouver.
  number: string | null;
  options: { choice: string; label: string }[];
};

export type AnonymousSurveyTemplateView = {
  code: SurveyTemplateCode;
  title: string;
  respondentLabel: string;
  questions: AnonymousSurveyQuestionView[];
};

function templateView(template: SurveyTemplate): AnonymousSurveyTemplateView {
  return {
    code: template.code,
    title: template.title,
    respondentLabel: template.respondentLabel,
    questions: anonymousQuestions(template).map((q) => ({
      id: q.id,
      prompt: q.prompt,
      help: q.help ?? null,
      number: q.number ?? null,
      options: SURVEY_SCALES[q.scale].options.map((o) => ({ choice: o.choice, label: o.label })),
    })),
  };
}

async function writeResponse(input: {
  tenantId: string;
  establishmentId: string;
  template: SurveyTemplate;
  mode: SurveyMode;
  channel: "TABLETTE" | "LIEN";
  answers: readonly AnonymousAnswer[];
}): Promise<void> {
  await prisma.anonymousSurveyResponse.create({
    data: {
      tenantId: input.tenantId,
      establishmentId: input.establishmentId,
      templateCode: input.template.code,
      templateVersion: input.template.version,
      respondentKind: respondentKindFor(input.template.code),
      mode: input.mode,
      channel: input.channel,
      completedOn: completedOnFor(new Date()),
      answers: { create: input.answers.map((a) => ({ questionId: a.questionId, choice: a.choice })) },
    },
    select: { id: true },
  });
}

// ── 1. Liens à usage unique, créés par la structure ──────────────────────────

export type CreateLinksResult = { error: string } | { templateCode: SurveyTemplateCode; tokens: string[]; expiresAt: Date };

export async function createAnonymousSurveyLinks(formData: FormData): Promise<CreateLinksResult> {
  const establishmentId = formData.get("establishmentId");
  if (typeof establishmentId !== "string" || establishmentId.length === 0) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TERRAIN_WRITE);
  if (access.isClient && !canDepositDocuments(access.missionAccess)) {
    return { error: "Votre accompagnement est clos : l'enquête est en lecture seule." };
  }
  const template = findSurveyTemplate(String(formData.get("templateCode") ?? ""));
  if (!template) return { error: "Questionnaire inconnu." };
  const count = parseLinkCount(formData.get("count"));
  if (count === null) return { error: "Indiquez un nombre de liens entre 1 et 100." };

  const establishment = await prisma.establishment.findUniqueOrThrow({
    where: { id: access.establishmentId },
    select: { tenantId: true },
  });
  const now = new Date();
  const expiresAt = oneTimeTokenExpiry(now, ANONYMOUS_SURVEY_LINK_TTL_HOURS);
  const tokens = Array.from({ length: count }, () => generateOneTimeToken());
  await prisma.anonymousSurveyInvite.createMany({
    data: tokens.map((token) => ({
      tenantId: establishment.tenantId,
      establishmentId: access.establishmentId,
      templateCode: template.code,
      tokenHash: hashOneTimeToken(token),
      expiresAt,
      createdByUserId: access.userId,
    })),
  });
  await recordAuditEvent({
    action: "ANONYMOUS_SURVEY_LINKS_CREATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    detail: `${template.code} · ${count}`,
  });
  // Les jetons ne sont rendus qu'ICI, une fois : la base n'en garde que l'empreinte.
  return { templateCode: template.code, tokens, expiresAt };
}

// ── 2. Page publique /enquete/[jeton] ────────────────────────────────────────

type LinkRefusal = { state: "INVALID" | "EXPIRED" | "USED" | "RATE_LIMITED" };

export type AnonymousSurveyLinkView =
  | LinkRefusal
  | { state: "VALID"; establishmentName: string; template: AnonymousSurveyTemplateView };

type ResolvedInvite = {
  invite: { id: string; tenantId: string; establishmentId: string; expiresAt: Date; establishmentName: string };
  template: SurveyTemplate;
};

async function resolveInvite(token: unknown): Promise<LinkRefusal | ResolvedInvite> {
  if (!isOneTimeTokenWellFormed(token)) return { state: "INVALID" };
  const ip = clientIpFromHeaders(await headers());
  const allowed = await consumeThrottledAttempt({
    key: `enquete:${ip}`,
    policy: LINK_RATE_LIMIT,
    auditAction: "ANONYMOUS_SURVEY_LINK_RATE_LIMITED",
  });
  if (!allowed) return { state: "RATE_LIMITED" };
  const invite = await prisma.anonymousSurveyInvite.findUnique({
    where: { tokenHash: hashOneTimeToken(token) },
    select: {
      id: true,
      tenantId: true,
      establishmentId: true,
      templateCode: true,
      tokenHash: true,
      expiresAt: true,
      usedAt: true,
      establishment: { select: { name: true } },
    },
  });
  if (!invite || !oneTimeTokenMatches(invite.tokenHash, token)) return { state: "INVALID" };
  const state = decideOneTimeTokenState(invite, new Date());
  if (state !== "VALID") return { state };
  const template = findSurveyTemplate(invite.templateCode);
  if (!template) return { state: "INVALID" };
  return {
    invite: {
      id: invite.id,
      tenantId: invite.tenantId,
      establishmentId: invite.establishmentId,
      expiresAt: invite.expiresAt,
      establishmentName: invite.establishment.name,
    },
    template,
  };
}

export async function openAnonymousSurveyLink(token: string): Promise<AnonymousSurveyLinkView> {
  const resolved = await resolveInvite(token);
  if ("state" in resolved) return resolved;
  return { state: "VALID", establishmentName: resolved.invite.establishmentName, template: templateView(resolved.template) };
}

export type AnonymousSubmitResult = LinkRefusal | { state: "DONE" } | { state: "ERROR"; error: string };

export async function submitAnonymousSurveyLink(token: string, rawAnswers: string): Promise<AnonymousSubmitResult> {
  const resolved = await resolveInvite(token);
  if ("state" in resolved) return resolved;
  const { invite, template } = resolved;
  const answers = parseAnonymousAnswers(template, rawAnswers);
  if (!answers.ok) return { state: "ERROR", error: answers.error };

  const now = new Date();
  const written = await prisma.$transaction(async (tx) => {
    // Usage unique ATOMIQUE : deux envois simultanés du même lien, un seul passe.
    const claimed = await tx.anonymousSurveyInvite.updateMany({
      where: { id: invite.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return false;
    await tx.anonymousSurveyResponse.create({
      data: {
        tenantId: invite.tenantId,
        establishmentId: invite.establishmentId,
        templateCode: template.code,
        templateVersion: template.version,
        respondentKind: respondentKindFor(template.code),
        // Par lien, la personne (ou son proche) répond SEULE.
        mode: "SEULE",
        channel: "LIEN",
        completedOn: completedOnFor(now),
        answers: { create: answers.value.map((a) => ({ questionId: a.questionId, choice: a.choice })) },
      },
      select: { id: true },
    });
    return true;
  });
  return written ? { state: "DONE" } : { state: "USED" };
}

// ── 3. Tablette enregistrée ──────────────────────────────────────────────────

export async function getTabletAnonymousSurveyTemplates(): Promise<AnonymousSurveyTemplateView[] | null> {
  const session = await resolveTabletSession();
  if (!session) return null;
  return (["PERSONNE", "FAMILLE"] as const).map((code) => {
    const template = findSurveyTemplate(code);
    if (!template) throw new Error(`Questionnaire ${code} absent du contenu.`);
    return templateView(template);
  });
}

export type TabletSubmitResult = { ok: true } | { error: string };

export async function submitTabletAnonymousSurvey(formData: FormData): Promise<TabletSubmitResult> {
  const session = await resolveTabletSession();
  if (!session) return { error: "La session de la tablette est terminée. Reconnectez-vous avec votre code." };
  const template = findSurveyTemplate(String(formData.get("templateCode") ?? ""));
  if (!template) return { error: "Questionnaire inconnu." };
  const rawMode = formData.get("mode");
  const mode: SurveyMode | null = rawMode === "ASSISTEE" ? "ASSISTEE" : rawMode === "SEULE" ? "SEULE" : null;
  if (!mode) return { error: "Indiquez si la personne a répondu seule ou avec vous." };
  const answers = parseAnonymousAnswers(template, formData.get("answers"));
  if (!answers.ok) return { error: answers.error };

  // Le salarié connecté n'est PAS enregistré avec la réponse : il désignerait la
  // personne qu'il est venu voir.
  await writeResponse({
    tenantId: session.tenantId,
    establishmentId: session.establishmentId,
    template,
    mode,
    channel: "TABLETTE",
    answers: answers.value,
  });
  revalidatePath("/dashboard/client/enquetes");
  return { ok: true };
}
