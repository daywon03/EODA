"use server";

import { notFound } from "next/navigation";
import { prisma, type Prisma } from "@eoda/database";
import { requireCabinetSession, requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { ASSISTANT_DAILY_CREDITS, MAX_QUESTION_LENGTH, conversationTitle, creditsFor } from "@/lib/services/assistant-service";
import { runCabinetAgent, type CabinetProposal, type CabinetProposalKind } from "@/lib/services/cabinet-assistant-agent";
import { AssistantChatError, getAssistantChatPort } from "@/lib/llm/assistant-chat";
import { resolveAssistantModel } from "@/lib/llm/assistant-models";
import { creditsUsedToday, debitCredits } from "@/lib/db/assistant-credits";
import { readToolsOnly } from "@/lib/services/assistant-ui-service";
import { cabinetAssistantDeps } from "@/lib/db/cabinet-assistant-deps";
import { MAX_DESIGN_NOTES_LENGTH } from "@/lib/services/document-design-service";
import { addDocumentComment } from "./document-comment";
import { requestInformationFromStructure } from "./information-request";
import { saveDocumentDesignNotes } from "./document-design";

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT DU MENU LATÉRAL (11/11/2026 — « comme MusicPlanner, mais pour EODA »).
// Cabinet seulement (requireCabinetSession : lecture STRUCTURES_READ, question et
// cartes STRUCTURES_WRITE) ; outils bornés au périmètre de l'appelant
// (cabinet-assistant-deps) ; conversation lue par son AUTEUR seulement ; mêmes 40
// crédits par jour que l'assistant de la fiche. Une carte se revérifie au clic et
// rejoue l'action réelle avec SA garde (structure dans le périmètre, ligne connue).
// Journal : crédits et outils utilisés, jamais la question ni la réponse.
// ─────────────────────────────────────────────────────────────────────────────

export type CabinetAssistantMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  proposals: CabinetProposal[];
  // Ce que l'assistant a lu pour cette réponse (noms d'outils) et ce qu'elle a coûté.
  toolsUsed: string[];
  credits: number;
  createdAt: Date;
};

export type CabinetAssistantState = {
  available: boolean;
  credits: { used: number; limit: number };
  conversations: { id: string; title: string; updatedAt: Date }[];
  conversationId: string | null;
  messages: CabinetAssistantMessage[];
};

const KINDS: readonly CabinetProposalKind[] = ["COMMENT", "INFORMATION_REQUEST", "DESIGN_NOTES"];
const OUT_OF_CREDITS = "Vous avez utilisé tous vos crédits du jour. Ils reviennent à minuit.";

function readProposals(value: Prisma.JsonValue | null): CabinetProposal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): CabinetProposal[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const p = item as Record<string, unknown>;
    if (!KINDS.includes(p.kind as CabinetProposalKind) || typeof p.text !== "string" || typeof p.establishmentId !== "string") return [];
    if (p.status !== "PENDING" && p.status !== "APPLIED" && p.status !== "DISMISSED") return [];
    return [
      {
        kind: p.kind as CabinetProposalKind,
        text: p.text,
        status: p.status,
        establishmentId: p.establishmentId,
        establishmentName: typeof p.establishmentName === "string" ? p.establishmentName : "",
        documentTypeId: typeof p.documentTypeId === "string" ? p.documentTypeId : null,
        documentLabel: typeof p.documentLabel === "string" ? p.documentLabel : null,
      },
    ];
  });
}

// Fils de l'assistant du menu : sans structure ni document, de CET utilisateur.
const menuThread = (userId: string) => ({ userId, establishmentId: null, documentTypeId: null });

async function loadMessages(conversationId: string): Promise<CabinetAssistantMessage[]> {
  const rows = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: { id: true, role: true, content: true, proposalsJson: true, toolsUsed: true, credits: true, createdAt: true },
  });
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    proposals: readProposals(m.proposalsJson),
    toolsUsed: m.toolsUsed,
    credits: m.credits,
    createdAt: m.createdAt,
  }));
}

async function ownThread(userId: string, conversationId: string): Promise<{ id: string }> {
  if (typeof conversationId !== "string" || conversationId.length === 0) notFound();
  const thread = await prisma.assistantConversation.findFirst({ where: { id: conversationId, ...menuThread(userId) }, select: { id: true } });
  if (!thread) notFound();
  return thread;
}

export async function getCabinetAssistant(conversationId: string | null = null): Promise<CabinetAssistantState> {
  const context = await requireCabinetSession("STRUCTURES_READ");
  const [used, conversations] = await Promise.all([
    creditsUsedToday(context.userId),
    prisma.assistantConversation.findMany({
      where: menuThread(context.userId),
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, updatedAt: true },
    }),
  ]);
  const selected = conversationId ? (await ownThread(context.userId, conversationId)).id : (conversations[0]?.id ?? null);
  return {
    available: getAssistantChatPort() !== null,
    credits: { used, limit: ASSISTANT_DAILY_CREDITS },
    conversations,
    conversationId: selected,
    messages: selected ? await loadMessages(selected) : [],
  };
}

export async function askCabinetAssistant(
  conversationId: string | null,
  question: string,
  modelId: string | null = null
): Promise<{ error: string } | { conversationId: string }> {
  const context = await requireCabinetSession("STRUCTURES_WRITE");
  const text = typeof question === "string" ? question.trim() : "";
  if (text.length === 0) return { error: "Posez une question." };
  if (text.length > MAX_QUESTION_LENGTH) return { error: `Une question tient en ${MAX_QUESTION_LENGTH} caractères au plus.` };
  const port = getAssistantChatPort();
  if (!port) return { error: "L'assistant n'est pas configuré sur ce serveur." };
  if ((await creditsUsedToday(context.userId)) >= ASSISTANT_DAILY_CREDITS) return { error: OUT_OF_CREDITS };

  const thread = conversationId
    ? await ownThread(context.userId, conversationId)
    : await prisma.assistantConversation.create({ data: { userId: context.userId, title: conversationTitle(text) }, select: { id: true } });
  const history = (await loadMessages(thread.id)).slice(-12).map((m) => ({
    role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
    content: [m.content, ...m.proposals.map((p) => `[Carte « ${p.text} » pour ${p.establishmentName} : ${p.status === "APPLIED" ? "faite" : p.status === "DISMISSED" ? "écartée" : "en attente"}]`)].join("\n"),
  }));
  await prisma.assistantMessage.create({ data: { conversationId: thread.id, role: "USER", content: text } });

  let credits = 1;
  let tools: string[] = [];
  try {
    const result = await runCabinetAgent({
      port,
      deps: cabinetAssistantDeps(context),
      question: text,
      history,
      userName: context.session.user.name ?? "la consultante",
      // Entrée du navigateur : un identifiant inconnu retombe sur le modèle par défaut.
      model: resolveAssistantModel(modelId).openRouterSlug,
    });
    credits = creditsFor(result.cost);
    tools = result.toolsUsed;
    await prisma.assistantMessage.create({
      data: { conversationId: thread.id, role: "ASSISTANT", content: result.text, proposalsJson: result.proposals, credits, model: result.model, toolsUsed: readToolsOnly(result.toolsUsed) },
    });
    await debitCredits(context.userId, credits, result.inputTokens, result.outputTokens);
  } catch (error) {
    if (error instanceof AssistantChatError && error.cost) await debitCredits(context.userId, creditsFor(error.cost), 0, 0);
    await prisma.assistantConversation.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    return { error: error instanceof AssistantChatError ? error.message : "L'assistant n'a pas pu répondre. Réessayez dans un instant." };
  }

  await prisma.assistantConversation.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
  await recordAuditEvent({
    action: "ASSISTANT_QUESTION_ASKED",
    actorUserId: context.userId,
    actorRole: context.session.user.role,
    targetId: thread.id,
    detail: `assistant du cabinet · ${credits} crédit${credits > 1 ? "s" : ""}${tools.length ? ` · outils : ${[...new Set(tools)].join(", ")}` : ""}`,
  });
  return { conversationId: thread.id };
}

// Confirmer ou écarter une carte. Le message doit appartenir à un fil de l'appelant ;
// l'action réelle revérifie la structure (son périmètre) et la ligne avec SA garde.
export async function resolveCabinetAssistantProposal(
  messageId: string,
  index: number,
  decision: "CONFIRM" | "DISMISS"
): Promise<{ error: string } | null> {
  const context = await requireCabinetSession("STRUCTURES_WRITE");
  if (typeof messageId !== "string" || messageId.length === 0) notFound();
  if (decision !== "CONFIRM" && decision !== "DISMISS") return { error: "Décision inconnue." };
  const message = await prisma.assistantMessage.findFirst({
    where: { id: messageId, role: "ASSISTANT", conversation: menuThread(context.userId) },
    select: { id: true, proposalsJson: true },
  });
  if (!message) notFound();
  const proposals = readProposals(message.proposalsJson);
  const proposal = Number.isInteger(index) ? proposals[index] : undefined;
  if (!proposal) return { error: "Proposition introuvable." };
  if (proposal.status !== "PENDING") return { error: "Cette proposition a déjà été traitée." };

  if (decision === "CONFIRM") {
    const result = await applyProposal(proposal);
    if (result) return result;
  }
  const next = proposals.map((p, i) => (i === index ? { ...p, status: decision === "CONFIRM" ? "APPLIED" : "DISMISSED" } : p));
  await prisma.assistantMessage.update({ where: { id: message.id }, data: { proposalsJson: next } });
  return null;
}

async function applyProposal(proposal: CabinetProposal): Promise<{ error: string } | null> {
  if (proposal.kind === "DESIGN_NOTES") {
    // La structure d'abord (périmètre, écriture) — jamais une lecture avant la garde.
    const { establishmentId } = await requireEstablishmentInTenant(proposal.establishmentId, "WRITE");
    // S'ajoute aux consignes existantes, ne les écrase jamais.
    const design = await prisma.establishmentDocumentDesign.findUnique({
      where: { establishmentId },
      select: { notes: true },
    });
    const merged = [design?.notes?.trim(), proposal.text].filter(Boolean).join("\n");
    if (merged.length > MAX_DESIGN_NOTES_LENGTH) return { error: "Les consignes de mise en page dépasseraient la longueur permise : modifiez-les dans les réglages de la structure." };
    return saveDocumentDesignNotes(establishmentId, merged);
  }
  if (!proposal.documentTypeId) return { error: "Proposition incomplète." };
  if (proposal.kind === "COMMENT") return addDocumentComment(proposal.establishmentId, proposal.documentTypeId, proposal.text, true);
  const form = new FormData();
  form.set("establishmentId", proposal.establishmentId);
  form.set("documentTypeId", proposal.documentTypeId);
  form.set("title", proposal.text);
  const result = await requestInformationFromStructure(form);
  return "error" in result ? { error: result.error } : null;
}

export async function deleteCabinetAssistantConversation(conversationId: string): Promise<null> {
  const context = await requireCabinetSession("STRUCTURES_WRITE");
  if (typeof conversationId !== "string" || conversationId.length === 0) notFound();
  const removed = await prisma.assistantConversation.deleteMany({ where: { id: conversationId, ...menuThread(context.userId) } });
  if (removed.count === 0) notFound();
  await recordAuditEvent({
    action: "ASSISTANT_CONVERSATION_DELETED",
    actorUserId: context.userId,
    actorRole: context.session.user.role,
    targetId: conversationId,
    detail: "conversation supprimée",
  });
  return null;
}
