"use server";

import { notFound } from "next/navigation";
import { prisma, type Prisma } from "@eoda/database";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { isRestrictedDocumentType } from "@/content/documents/acces-restreint";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";
import { commentsForAnalysis } from "@/lib/services/document-comment-thread-service";
import {
  ASSISTANT_DAILY_CREDITS,
  ASSISTANT_REPLY_RESERVE,
  MAX_QUESTION_LENGTH,
  buildAssistantContext,
  buildAssistantSystemPrompt,
  conversationTitle,
  creditsFor,
  parseAssistantReply,
  proposalDecisionError,
  recentHistory,
  summarizeAnalysis,
  type AssistantProposal,
} from "@/lib/services/assistant-service";
import { AssistantChatError, getAssistantChatPort } from "@/lib/llm/assistant-chat";
import { resolveAssistantModel } from "@/lib/llm/assistant-models";
import { creditsUsedToday, debitCredits } from "@/lib/db/assistant-credits";
import { addDocumentComment } from "./document-comment";
import { requestInformationFromStructure } from "./information-request";

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT DE LA FICHE DOCUMENT (lot F, 11/11/2026) — construit comme MusicPlanner.
//
// Cabinet seulement (requireEstablishmentInTenant : rôle, tenant, périmètre de la
// consultante) ; jamais une structure, jamais un document à accès restreint (ADR
// 20261110). Une conversation n'est lue que par son AUTEUR. 40 crédits par jour et par
// compte (assistant-service). Confirmer une carte rejoue l'action réelle, avec SA
// garde : addDocumentComment, requestInformationFromStructure. Journal : crédits et
// code du type, jamais la question ni la réponse.
// ─────────────────────────────────────────────────────────────────────────────

export type AssistantMessageView = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  proposals: AssistantProposal[];
  credits: number;
  createdAt: Date;
};

export type AssistantState = {
  available: boolean;
  unavailableReason: string | null;
  credits: { used: number; limit: number };
  conversations: { id: string; title: string; updatedAt: Date }[];
  conversationId: string | null;
  messages: AssistantMessageView[];
};

const UNAVAILABLE_NO_KEY = "L'assistant n'est pas configuré sur ce serveur.";
const UNAVAILABLE_RESTRICTED = "Document à accès restreint : l'assistant ne le lit pas.";
const OUT_OF_CREDITS = "Vous avez utilisé tous vos crédits du jour. Ils reviennent à minuit.";

function readProposals(value: Prisma.JsonValue | null): AssistantProposal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AssistantProposal[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const { kind, text, status } = item as Record<string, unknown>;
    if ((kind !== "COMMENT" && kind !== "INFORMATION_REQUEST") || typeof text !== "string") return [];
    if (status !== "PENDING" && status !== "APPLIED" && status !== "DISMISSED") return [];
    return [{ kind, text, status }];
  });
}

async function findLine(documentTypeId: string): Promise<{ id: string; code: string; label: string }> {
  if (typeof documentTypeId !== "string" || documentTypeId.length === 0) notFound();
  const line = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, code: true, label: true, archivedAt: true },
  });
  if (!line || line.archivedAt) notFound();
  return line;
}

async function loadMessages(conversationId: string): Promise<AssistantMessageView[]> {
  const rows = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, role: true, content: true, proposalsJson: true, credits: true, createdAt: true },
  });
  return rows.map((m) => ({ ...m, proposals: readProposals(m.proposalsJson) }));
}

// La conversation doit appartenir à CET utilisateur, sur CE document de CETTE structure.
async function ownConversation(userId: string, establishmentId: string, documentTypeId: string, conversationId: string) {
  if (typeof conversationId !== "string" || conversationId.length === 0) notFound();
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id: conversationId, userId, establishmentId, documentTypeId },
    select: { id: true },
  });
  if (!conversation) notFound();
  return conversation;
}

export async function getDocumentAssistant(
  establishmentId: string,
  documentTypeId: string,
  conversationId: string | null = null
): Promise<AssistantState> {
  const access = await requireEstablishmentInTenant(establishmentId, "READ");
  const line = await findLine(documentTypeId);
  const restricted = isRestrictedDocumentType(line.code);
  const hasPort = getAssistantChatPort() !== null;

  const [used, conversations] = await Promise.all([
    creditsUsedToday(access.userId),
    prisma.assistantConversation.findMany({
      where: { userId: access.userId, establishmentId: access.establishmentId, documentTypeId: line.id },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true },
    }),
  ]);
  const selected = conversationId
    ? (await ownConversation(access.userId, access.establishmentId, line.id, conversationId)).id
    : (conversations[0]?.id ?? null);

  return {
    available: hasPort && !restricted,
    unavailableReason: restricted ? UNAVAILABLE_RESTRICTED : hasPort ? null : UNAVAILABLE_NO_KEY,
    credits: { used, limit: ASSISTANT_DAILY_CREDITS },
    conversations,
    conversationId: selected,
    messages: selected ? await loadMessages(selected) : [],
  };
}

export async function askDocumentAssistant(
  establishmentId: string,
  documentTypeId: string,
  conversationId: string | null,
  question: string,
  modelId: string | null = null
): Promise<{ error: string } | { conversationId: string }> {
  const access = await requireEstablishmentInTenant(establishmentId, "WRITE");
  const line = await findLine(documentTypeId);
  if (isRestrictedDocumentType(line.code)) return { error: UNAVAILABLE_RESTRICTED };

  const text = typeof question === "string" ? question.trim() : "";
  if (text.length === 0) return { error: "Posez une question." };
  if (text.length > MAX_QUESTION_LENGTH) return { error: `Une question tient en ${MAX_QUESTION_LENGTH} caractères au plus.` };

  const port = getAssistantChatPort();
  if (!port) return { error: UNAVAILABLE_NO_KEY };
  if ((await creditsUsedToday(access.userId)) >= ASSISTANT_DAILY_CREDITS) return { error: OUT_OF_CREDITS };

  const conversation = conversationId
    ? await ownConversation(access.userId, access.establishmentId, line.id, conversationId)
    : await prisma.assistantConversation.create({
        data: { userId: access.userId, establishmentId: access.establishmentId, documentTypeId: line.id, title: conversationTitle(text) },
        select: { id: true },
      });

  // Le contexte du document : lu ICI, pour CETTE structure — jamais reçu du navigateur.
  const [document, links, history] = await Promise.all([
    prisma.document.findUnique({
      where: { establishmentId_documentTypeId: { establishmentId: access.establishmentId, documentTypeId: line.id } },
      select: {
        missingJustification: true,
        commentUsedByAi: true,
        comments: { select: { text: true, aiEnabled: true, createdAt: true } },
        currentVersion: { select: { extractedText: true, analysisResultJson: true } },
      },
    }),
    prisma.documentTypeCriterion.findMany({
      where: { documentTypeId: line.id },
      select: { criterion: { select: { code: true, label: true } } },
    }),
    loadMessages(conversation.id),
  ]);

  const context = buildAssistantContext({
    documentLabel: line.label,
    criteria: links.map((l) => l.criterion),
    analysisSummary: summarizeAnalysis(parseAnalysisResult(document?.currentVersion?.analysisResultJson ?? null)),
    comments:
      commentsForAnalysis(document?.comments ?? [], {
        text: document?.missingJustification ?? null,
        usedByAi: document?.commentUsedByAi === true,
      }) ?? null,
    documentText: document?.currentVersion?.extractedText ?? null,
  });

  await prisma.assistantMessage.create({ data: { conversationId: conversation.id, role: "USER", content: text } });

  let replyCredits = 1;
  try {
    const reply = await port.reply(
      [
        { role: "system", content: buildAssistantSystemPrompt() },
        { role: "system", content: context },
        ...recentHistory(history),
        { role: "user", content: text },
      ],
      {
        maxTokens: ASSISTANT_REPLY_RESERVE,
        sourceText: document?.currentVersion?.extractedText ?? undefined,
        model: resolveAssistantModel(modelId).openRouterSlug,
      }
    );
    replyCredits = creditsFor(reply.cost);
    const parsed = reply.truncated
      ? { text: "La réponse a été coupée faute de place. Posez une question plus courte ou plus précise.", proposals: [] }
      : parseAssistantReply(reply.text);
    await prisma.assistantMessage.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: parsed.text,
        proposalsJson: parsed.proposals,
        credits: replyCredits,
        model: reply.model,
      },
    });
    await debitCredits(access.userId, replyCredits, reply.inputTokens, reply.outputTokens);
  } catch (error) {
    // Des jetons consommés malgré l'échec se décomptent quand même (MusicPlanner).
    if (error instanceof AssistantChatError && error.cost) await debitCredits(access.userId, creditsFor(error.cost), 0, 0);
    await prisma.assistantConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return {
      error:
        error instanceof AssistantChatError
          ? error.message
          : "L'assistant n'a pas pu répondre. Réessayez dans un instant.",
    };
  }

  await prisma.assistantConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  await recordAuditEvent({
    action: "ASSISTANT_QUESTION_ASKED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: line.id,
    detail: `${line.code} · ${replyCredits} crédit${replyCredits > 1 ? "s" : ""}`,
  });
  return { conversationId: conversation.id };
}

// Confirmer ou écarter une carte. Gratuit. Le serveur revérifie TOUT : le message est
// celui d'une conversation de l'appelant, sur cette structure ; puis l'action réelle
// passe par SA propre garde.
export async function resolveAssistantProposal(
  establishmentId: string,
  messageId: string,
  index: number,
  decision: "CONFIRM" | "DISMISS"
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentInTenant(establishmentId, "WRITE");
  if (typeof messageId !== "string" || messageId.length === 0) notFound();
  if (decision !== "CONFIRM" && decision !== "DISMISS") return { error: "Décision inconnue." };

  const message = await prisma.assistantMessage.findFirst({
    where: { id: messageId, role: "ASSISTANT", conversation: { userId: access.userId, establishmentId: access.establishmentId } },
    select: { id: true, proposalsJson: true, conversation: { select: { documentTypeId: true } } },
  });
  if (!message) notFound();

  const proposals = readProposals(message.proposalsJson);
  const proposal = Number.isInteger(index) ? proposals[index] : undefined;
  const error = proposalDecisionError(proposal);
  if (error || !proposal) return { error: error ?? "Proposition introuvable." };

  if (decision === "CONFIRM") {
    const documentTypeId = message.conversation.documentTypeId;
    // Une conversation de la fiche porte toujours son document ; sinon, rien à rejouer.
    if (!documentTypeId) notFound();
    if (proposal.kind === "COMMENT") {
      const result = await addDocumentComment(access.establishmentId, documentTypeId, proposal.text, true);
      if (result && "error" in result) return result;
    } else {
      const form = new FormData();
      form.set("establishmentId", access.establishmentId);
      form.set("documentTypeId", documentTypeId);
      form.set("title", proposal.text);
      const result = await requestInformationFromStructure(form);
      if (result && "error" in result) return { error: result.error };
    }
  }

  const next = proposals.map((p, i) => (i === index ? { ...p, status: decision === "CONFIRM" ? "APPLIED" : "DISMISSED" } : p));
  await prisma.assistantMessage.update({ where: { id: message.id }, data: { proposalsJson: next } });
  return null;
}

export async function deleteAssistantConversation(establishmentId: string, conversationId: string): Promise<null> {
  const access = await requireEstablishmentInTenant(establishmentId, "WRITE");
  if (typeof conversationId !== "string" || conversationId.length === 0) notFound();
  const removed = await prisma.assistantConversation.deleteMany({
    where: { id: conversationId, userId: access.userId, establishmentId: access.establishmentId },
  });
  if (removed.count === 0) notFound();
  await recordAuditEvent({
    action: "ASSISTANT_CONVERSATION_DELETED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: conversationId,
    detail: "conversation supprimée",
  });
  return null;
}
