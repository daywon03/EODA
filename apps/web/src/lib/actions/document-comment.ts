"use server";

import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { newDocumentCommentError } from "@/lib/services/document-comment-thread-service";

// ─────────────────────────────────────────────────────────────────────────────
// LE FIL DE COMMENTAIRES D'UN DOCUMENT (retour de Sandrine, 10/11/2026 : « je ne vois
// pas l'historique »). Cabinet seulement, sur une structure de SON cabinet et de son
// périmètre (requireEstablishmentInTenant) ; identifiants reçus = entrées non fiables.
// Append-only : un commentaire ne se modifie ni ne se supprime, seul « pris en compte
// par l'IA » se bascule. Le journal porte le code du type, JAMAIS le texte.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentCommentItem = {
  id: string;
  text: string;
  aiEnabled: boolean;
  createdAt: Date;
  authorName: string | null;
};

async function findDocumentType(documentTypeId: string): Promise<{ id: string; code: string }> {
  if (typeof documentTypeId !== "string" || documentTypeId.length === 0) notFound();
  const type = await prisma.documentType.findUnique({ where: { id: documentTypeId }, select: { id: true, code: true } });
  if (!type) notFound();
  return type;
}

// Du plus récent au plus ancien : on lit d'abord ce qui vient d'être dit.
export async function listDocumentComments(establishmentId: string, documentTypeId: string): Promise<DocumentCommentItem[]> {
  const access = await requireEstablishmentInTenant(establishmentId, "READ");
  const type = await findDocumentType(documentTypeId);
  const comments = await prisma.documentComment.findMany({
    where: { document: { establishmentId: access.establishmentId, documentTypeId: type.id } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, text: true, aiEnabled: true, createdAt: true, author: { select: { name: true } } },
  });
  return comments.map((c) => ({
    id: c.id,
    text: c.text,
    aiEnabled: c.aiEnabled,
    createdAt: c.createdAt,
    authorName: c.author?.name ?? null,
  }));
}

export async function addDocumentComment(
  establishmentId: string,
  documentTypeId: string,
  text: string,
  aiEnabled = true
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentInTenant(establishmentId, "WRITE");
  const type = await findDocumentType(documentTypeId);
  const error = newDocumentCommentError(typeof text === "string" ? text : "");
  if (error) return { error };

  // Aucune ligne encore : le commentaire précède le dépôt, le document reste manquant.
  const document = await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId: access.establishmentId, documentTypeId: type.id } },
    update: {},
    create: { establishmentId: access.establishmentId, documentTypeId: type.id, status: "MISSING" },
    select: { id: true },
  });
  await prisma.documentComment.create({
    data: { documentId: document.id, authorUserId: access.userId, text: text.trim(), aiEnabled: aiEnabled === true },
  });
  await recordAuditEvent({
    action: "DOCUMENT_COMMENT_ADDED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: type.id,
    detail: type.code,
  });
  return null;
}

export async function setDocumentCommentAiUse(
  establishmentId: string,
  commentId: string,
  enabled: boolean
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentInTenant(establishmentId, "WRITE");
  if (typeof commentId !== "string" || commentId.length === 0) notFound();
  // Le commentaire doit appartenir à un document de CETTE structure (IDOR).
  const comment = await prisma.documentComment.findFirst({
    where: { id: commentId, document: { establishmentId: access.establishmentId } },
    select: { id: true, aiEnabled: true, document: { select: { documentTypeId: true, documentType: { select: { code: true } } } } },
  });
  if (!comment) notFound();
  const next = enabled === true;
  if (comment.aiEnabled === next) return null;

  await prisma.documentComment.update({ where: { id: comment.id }, data: { aiEnabled: next } });
  await recordAuditEvent({
    action: "DOCUMENT_COMMENT_AI_TOGGLED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: comment.document.documentTypeId ?? comment.id,
    detail: `${comment.document.documentType?.code ?? "?"} · ${next ? "oui" : "non"}`,
  });
  return null;
}
