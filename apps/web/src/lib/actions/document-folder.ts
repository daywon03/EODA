"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";
import { prisma, type DocumentCategory } from "@eoda/database";
import { requireCabinetAdminSession, requireCabinetSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { CRITERION_MATRIX_TAG } from "@/lib/db/referential-cache";
import { documentFolderLabelError, nextFolderPosition } from "@/lib/services/document-folder-service";
import {
  documentTypeCode,
  documentTypeCreationError,
  isCreatableCategory,
  normalizeDocumentTypeLabel,
} from "@/lib/services/document-type-creation-service";
import {
  parseImportPayload,
  planDocumentTypeImport,
  type ImportLinePlan,
} from "@/lib/services/document-type-import-service";

// ─────────────────────────────────────────────────────────────────────────────
// DOSSIERS DE LA LISTE « DOCUMENTS » ET IMPORT D'UN TABLEUR (call du 29/10/2026).
//
// Comme les lignes, les dossiers valent pour toutes les structures : les créer, les
// renommer et y ranger une ligne est une politique de cabinet — CABINET_ADMIN seul,
// la même garde que la création d'une ligne. Règles pures :
// document-folder-service.ts, document-type-import-service.ts.
// ─────────────────────────────────────────────────────────────────────────────

type Result<T = object> = { error: string } | ({ ok: true } & T);

function revalidateDocumentScreens(): void {
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/cabinet");
}

export type DocumentFolderItem = { id: string; label: string; position: number; lineCount: number };

// Les dossiers, dans l'ordre du cabinet. Lecture : tout rôle de cabinet (ce ne sont
// que des intitulés de rangement).
export async function listDocumentFolders(): Promise<DocumentFolderItem[]> {
  await requireCabinetSession("ANY_CABINET_ROLE");
  const folders = await prisma.documentFolder.findMany({
    orderBy: [{ position: "asc" }, { label: "asc" }],
    select: { id: true, label: true, position: true, _count: { select: { documentTypes: true } } },
  });
  return folders.map(({ _count, ...folder }) => ({ ...folder, lineCount: _count.documentTypes }));
}

export async function createDocumentFolder(rawLabel: unknown): Promise<Result<{ folderId: string; label: string }>> {
  const { session, userId } = await requireCabinetAdminSession();
  if (typeof rawLabel !== "string") return { error: "Valeur invalide." };
  const label = normalizeDocumentTypeLabel(rawLabel);

  const folders = await prisma.documentFolder.findMany({ select: { label: true, position: true } });
  const problem = documentFolderLabelError(label, folders.map((folder) => folder.label));
  if (problem) return { error: problem };

  const created = await prisma.documentFolder.create({
    data: { label, position: nextFolderPosition(folders) },
    select: { id: true },
  });
  await recordAuditEvent({
    action: "DOCUMENT_FOLDER_CREATED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: created.id,
    detail: `« ${label} »`,
  });
  revalidateDocumentScreens();
  return { ok: true, folderId: created.id, label };
}

export async function renameDocumentFolder(folderId: unknown, rawLabel: unknown): Promise<Result<{ label: string }>> {
  const { session, userId } = await requireCabinetAdminSession();
  if (typeof folderId !== "string" || typeof rawLabel !== "string") return { error: "Valeur invalide." };
  const label = normalizeDocumentTypeLabel(rawLabel);

  const folder = await prisma.documentFolder.findUnique({ where: { id: folderId }, select: { id: true, label: true } });
  if (!folder) notFound();
  if (folder.label === label) return { ok: true, label };

  const others = await prisma.documentFolder.findMany({ where: { id: { not: folder.id } }, select: { label: true } });
  const problem = documentFolderLabelError(label, others.map((other) => other.label));
  if (problem) return { error: problem };

  await prisma.documentFolder.update({ where: { id: folder.id }, data: { label } });
  await recordAuditEvent({
    action: "DOCUMENT_FOLDER_RENAMED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: folder.id,
    detail: `« ${folder.label} » → « ${label} »`,
  });
  revalidateDocumentScreens();
  return { ok: true, label };
}

// Range une ligne dans un dossier, ou la remet à plat (`folderId` vide).
export async function setDocumentTypeFolder(documentTypeId: unknown, folderId: unknown): Promise<Result> {
  const { session, userId } = await requireCabinetAdminSession();
  if (typeof documentTypeId !== "string" || typeof folderId !== "string") return { error: "Valeur invalide." };

  const documentType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, code: true, folderId: true },
  });
  if (!documentType) notFound();
  const target = folderId === "" ? null : await prisma.documentFolder.findUnique({ where: { id: folderId }, select: { id: true, label: true } });
  if (folderId !== "" && !target) notFound();
  if ((target?.id ?? null) === documentType.folderId) return { ok: true };

  await prisma.documentType.update({ where: { id: documentType.id }, data: { folderId: target?.id ?? null } });
  await recordAuditEvent({
    action: "DOCUMENT_TYPE_FOLDER_CHANGED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: `${documentType.code} → ${target ? `« ${target.label} »` : "hors dossier"}`,
  });
  revalidateDocumentScreens();
  return { ok: true };
}

// ── Import d'un tableur ──────────────────────────────────────────────────────

async function importContext() {
  const [types, criteria] = await Promise.all([
    prisma.documentType.findMany({ select: { label: true, code: true, archivedAt: true } }),
    prisma.criterion.findMany({ select: { id: true, code: true } }),
  ]);
  return { types, criteria };
}

function planFor(
  rows: { label: string; criteria: string[] }[],
  category: string,
  context: Awaited<ReturnType<typeof importContext>>
): ImportLinePlan[] {
  return planDocumentTypeImport({
    rows,
    // Une ligne retirée (archivée) ne fait pas doublon ; son CODE reste pris.
    existingLabels: context.types.filter((type) => !type.archivedAt).map((type) => type.label),
    knownCriterionCodes: new Set(context.criteria.map((criterion) => criterion.code)),
    // Même règle de libellé que la création à la main (doublons traités à part).
    labelError: (label) => documentTypeCreationError({ label, category, existingLabels: [] }),
  });
}

// Aperçu : ce que l'import ferait, ligne par ligne. N'écrit rien.
export async function previewDocumentTypeImport(rawRows: unknown, category: unknown): Promise<Result<{ lines: ImportLinePlan[] }>> {
  await requireCabinetAdminSession();
  const rows = parseImportPayload(rawRows);
  if (!rows) return { error: "Le fichier ne contient aucune ligne lisible (200 au plus)." };
  if (typeof category !== "string" || !isCreatableCategory(category)) return { error: "Catégorie invalide." };
  return { ok: true, lines: planFor(rows, category, await importContext()) };
}

// Crée, en une transaction, les lignes cochées — RECALCULÉES ici : seules celles que
// le plan juge neuves et sans problème sont écrites, quoi que le navigateur envoie.
export async function importDocumentTypes(input: {
  rows: unknown;
  category: unknown;
  provider: unknown;
  folderId: unknown;
}): Promise<Result<{ created: number; skipped: number }>> {
  const { session, userId } = await requireCabinetAdminSession();
  const rows = parseImportPayload(input.rows);
  if (!rows) return { error: "Aucune ligne à créer." };
  if (typeof input.category !== "string" || !isCreatableCategory(input.category)) return { error: "Catégorie invalide." };
  const category: DocumentCategory = input.category;
  const requestedFromClient = input.provider === "STRUCTURE";
  if (typeof input.folderId !== "string") return { error: "Valeur invalide." };
  const folder =
    input.folderId === ""
      ? null
      : await prisma.documentFolder.findUnique({ where: { id: input.folderId }, select: { id: true, label: true } });
  if (input.folderId !== "" && !folder) notFound();

  const context = await importContext();
  const creatable = planFor(rows, category, context).filter((line) => line.status === "NEW");
  if (creatable.length === 0) return { error: "Aucune ligne neuve à créer." };

  const idByCode = new Map(context.criteria.map((criterion) => [criterion.code, criterion.id]));
  const codes = context.types.map((type) => type.code);
  const planned = creatable.map((line) => {
    const code = documentTypeCode(line.label, codes);
    codes.push(code);
    return { ...line, code };
  });

  await prisma.$transaction(async (tx) => {
    for (const line of planned) {
      const created = await tx.documentType.create({
        data: { code: line.code, category, label: line.label, requestedFromClient, folderId: folder?.id ?? null },
        select: { id: true },
      });
      const links = line.criteria.flatMap((code) => {
        const criterionId = idByCode.get(code);
        return criterionId ? [{ documentTypeId: created.id, criterionId }] : [];
      });
      if (links.length > 0) await tx.documentTypeCriterion.createMany({ data: links, skipDuplicates: true });
    }
  });

  await recordAuditEvent({
    action: "DOCUMENT_TYPES_IMPORTED",
    actorUserId: userId,
    actorRole: session.user.role,
    detail:
      `${planned.length} ligne(s) (${category})` +
      (folder ? ` dans « ${folder.label} »` : "") +
      ` : ${planned.map((line) => line.code).join(", ")}`,
  });
  if (planned.some((line) => line.criteria.length > 0)) revalidateTag(CRITERION_MATRIX_TAG);
  revalidateDocumentScreens();
  return { ok: true, created: planned.length, skipped: rows.length - planned.length };
}
