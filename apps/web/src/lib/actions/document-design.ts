"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@eoda/database";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { validateUploadOnServer } from "@/lib/security/office-archive-guard";
import { DOCX_MIME_TYPE } from "@/lib/security/upload-validation-service";
import { getFileStoragePort } from "@/lib/storage";
import { MAX_DESIGN_NOTES_LENGTH } from "@/lib/services/document-design-service";

// ─────────────────────────────────────────────────────────────────────────────
// MISE EN PAGE DES DOCUMENTS D'UNE STRUCTURE (11/11/2026 — « la mise en conformité ne
// garde pas le design des documents »). Le cabinet dépose un Word MODÈLE de la structure
// (son papier à en-tête, ses styles) et/ou écrit des CONSIGNES ; la mise en conformité
// s'en sert quand le document corrigé n'est pas lui-même un Word (final-docx-builder),
// et les consignes partent à la génération comme une donnée.
// Cabinet seulement, structure de son périmètre (requireEstablishmentInTenant) ; le
// fichier est vérifié par SIGNATURE et décompression bornée ; la clé de stockage ne
// contient jamais le nom d'origine ; journal sans le texte des consignes.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MODEL_BYTES = 15 * 1024 * 1024;

export type DocumentDesignView = { modelFilename: string | null; notes: string | null; updatedAt: Date } | null;

function revalidate(establishmentId: string): void {
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}/reglages`);
}

async function audit(access: { userId: string; session: { user: { role: string } } }, establishmentId: string, detail: string) {
  await recordAuditEvent({
    action: "DOCUMENT_DESIGN_UPDATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: establishmentId,
    detail,
  });
}

export async function getDocumentDesign(establishmentId: string): Promise<DocumentDesignView> {
  const access = await requireEstablishmentInTenant(establishmentId, "READ");
  return prisma.establishmentDocumentDesign.findUnique({
    where: { establishmentId: access.establishmentId },
    select: { modelFilename: true, notes: true, updatedAt: true },
  });
}

export async function saveDocumentDesignNotes(establishmentId: string, notes: string): Promise<{ error: string } | null> {
  const access = await requireEstablishmentInTenant(establishmentId, "WRITE");
  const text = typeof notes === "string" ? notes.trim() : "";
  if (text.length > MAX_DESIGN_NOTES_LENGTH) {
    return { error: `Les consignes tiennent en ${MAX_DESIGN_NOTES_LENGTH} caractères au plus.` };
  }
  await prisma.establishmentDocumentDesign.upsert({
    where: { establishmentId: access.establishmentId },
    create: { establishmentId: access.establishmentId, notes: text || null, updatedByUserId: access.userId },
    update: { notes: text || null, updatedByUserId: access.userId },
  });
  await audit(access, access.establishmentId, text ? "consignes enregistrées" : "consignes effacées");
  revalidate(access.establishmentId);
  return null;
}

export async function uploadDocumentDesignModel(formData: FormData): Promise<{ error: string } | null> {
  const establishmentIdRaw = formData.get("establishmentId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) return { error: "Structure manquante." };
  const access = await requireEstablishmentInTenant(establishmentIdRaw, "WRITE");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier Word." };
  if (file.size > MAX_MODEL_BYTES) return { error: "Le modèle dépasse 15 Mo." };
  const content = Buffer.from(await file.arrayBuffer());
  // Le type se décide par SIGNATURE, jamais par l'extension ni par File.type.
  const validation = validateUploadOnServer(content, file.size);
  if (!validation.ok) return { error: validation.error };
  if (validation.contentType !== DOCX_MIME_TYPE) return { error: "Le modèle doit être un document Word (.docx)." };

  const storage = getFileStoragePort();
  const key = `designs/${access.establishmentId}/${randomUUID()}.docx`;
  await storage.upload(key, content, DOCX_MIME_TYPE);
  const previous = await prisma.establishmentDocumentDesign.findUnique({
    where: { establishmentId: access.establishmentId },
    select: { modelFileKey: true },
  });
  const filename = file.name.slice(0, 200);
  await prisma.establishmentDocumentDesign.upsert({
    where: { establishmentId: access.establishmentId },
    create: { establishmentId: access.establishmentId, modelFileKey: key, modelFilename: filename, updatedByUserId: access.userId },
    update: { modelFileKey: key, modelFilename: filename, updatedByUserId: access.userId },
  });
  // L'ancien modèle n'a plus de raison d'exister ; un échec de suppression ne défait rien.
  if (previous?.modelFileKey) await storage.delete(previous.modelFileKey).catch(() => undefined);
  await audit(access, access.establishmentId, "modèle Word déposé");
  revalidate(access.establishmentId);
  return null;
}

export async function removeDocumentDesignModel(establishmentId: string): Promise<{ error: string } | null> {
  const access = await requireEstablishmentInTenant(establishmentId, "WRITE");
  const design = await prisma.establishmentDocumentDesign.findUnique({
    where: { establishmentId: access.establishmentId },
    select: { modelFileKey: true },
  });
  if (!design?.modelFileKey) return null;
  await prisma.establishmentDocumentDesign.update({
    where: { establishmentId: access.establishmentId },
    data: { modelFileKey: null, modelFilename: null, updatedByUserId: access.userId },
  });
  await getFileStoragePort().delete(design.modelFileKey).catch(() => undefined);
  await audit(access, access.establishmentId, "modèle Word retiré");
  revalidate(access.establishmentId);
  return null;
}
