"use server";

import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { requireAdminEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { hideForEstablishmentError } from "@/lib/services/document-type-exclusion-service";
import { revalidateDocumentViews } from "./document-views-revalidation";

// ─────────────────────────────────────────────────────────────────────────────
// MASQUER / RÉTABLIR UNE LIGNE DE « DOCUMENTS » POUR UNE SEULE STRUCTURE (retour de
// Sandrine, 10/11/2026). Administration du cabinet sur une structure de SON cabinet
// (requireAdminEstablishmentInTenant, sinon notFound) ; les identifiants reçus sont
// des entrées non fiables. Règles dans document-type-exclusion-service ; lectures
// filtrées par documentTypeVisibleTo. Journal par CODE de ligne, jamais un texte libre.
// ─────────────────────────────────────────────────────────────────────────────

async function findActiveLine(documentTypeId: string) {
  if (typeof documentTypeId !== "string" || documentTypeId.length === 0) notFound();
  const line = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, code: true, category: true, archivedAt: true },
  });
  if (!line || line.archivedAt) notFound();
  return line;
}

export async function hideDocumentTypeForEstablishment(
  establishmentId: string,
  documentTypeId: string
): Promise<{ error: string } | null> {
  const access = await requireAdminEstablishmentInTenant(establishmentId);
  const line = await findActiveLine(documentTypeId);

  const document = await prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId: access.establishmentId, documentTypeId: line.id } },
    select: { currentVersionId: true },
  });
  const error = hideForEstablishmentError({ category: line.category, hasDeposit: document?.currentVersionId != null });
  if (error) return { error };

  const pair = { establishmentId: access.establishmentId, documentTypeId: line.id };
  await prisma.establishmentDocumentTypeExclusion.upsert({
    where: { establishmentId_documentTypeId: pair },
    create: pair,
    update: {},
  });
  await recordAuditEvent({
    action: "DOCUMENT_TYPE_HIDDEN_FOR_ESTABLISHMENT",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: line.id,
    detail: line.code,
  });

  revalidateDocumentViews(access.establishmentId);
  return null;
}

export async function restoreDocumentTypeForEstablishment(
  establishmentId: string,
  documentTypeId: string
): Promise<{ error: string } | null> {
  const access = await requireAdminEstablishmentInTenant(establishmentId);
  const line = await findActiveLine(documentTypeId);

  const removed = await prisma.establishmentDocumentTypeExclusion.deleteMany({
    where: { establishmentId: access.establishmentId, documentTypeId: line.id },
  });
  if (removed.count > 0) {
    await recordAuditEvent({
      action: "DOCUMENT_TYPE_RESTORED_FOR_ESTABLISHMENT",
      actorUserId: access.userId,
      actorRole: access.session.user.role,
      establishmentId: access.establishmentId,
      targetId: line.id,
      detail: line.code,
    });
  }

  revalidateDocumentViews(access.establishmentId);
  return null;
}

export type HiddenDocumentType = { documentTypeId: string; label: string; hiddenAt: Date };

// « Lignes masquées pour cette structure » : de quoi les rétablir. Une ligne archivée
// depuis (retirée pour tout le monde) ne se rétablit plus ici.
export async function listHiddenDocumentTypes(establishmentId: string): Promise<HiddenDocumentType[]> {
  const access = await requireAdminEstablishmentInTenant(establishmentId);
  const rows = await prisma.establishmentDocumentTypeExclusion.findMany({
    where: { establishmentId: access.establishmentId },
    select: { hiddenAt: true, documentType: { select: { id: true, label: true, archivedAt: true } } },
  });
  return rows
    .filter((r) => r.documentType.archivedAt === null)
    .map((r) => ({ documentTypeId: r.documentType.id, label: r.documentType.label, hiddenAt: r.hiddenAt }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }));
}
