"use server";

import { prisma } from "@eoda/database";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { extractText } from "@/lib/services/text-extraction-service";
import { suggestDocumentType } from "@/lib/services/document-categorization-service";
import { getFileStoragePort } from "@/lib/storage";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

async function requireEstablishmentAccess(establishmentId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  if (session.user.role === "CLIENT_USER") {
    const link = await prisma.establishmentUser.findUnique({
      where: { userId_establishmentId: { userId: session.user.id, establishmentId } },
    });
    if (!link) redirect("/login");
  }

  return session;
}

export type DocumentTypeCandidate = { id: string; label: string; category: string };

export type UploadDocumentResult =
  | { success: true; documentTypeId: string }
  | { error: string; needsManualType?: true; candidates?: DocumentTypeCandidate[] };

export async function uploadDocument(formData: FormData): Promise<UploadDocumentResult> {
  const establishmentId = formData.get("establishmentId") as string | null;
  if (!establishmentId) return { error: "Établissement manquant." };

  const session = await requireEstablishmentAccess(establishmentId);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Aucun fichier sélectionné." };
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "Fichier trop volumineux (20 Mo maximum)." };
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { error: "Format non supporté — seuls les fichiers PDF et DOCX sont acceptés." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extractedText = await extractText(buffer, file.type);

  let documentTypeId = (formData.get("documentTypeId") as string | null) || null;

  if (!documentTypeId) {
    const allTypes = await prisma.documentType.findMany({
      select: { id: true, code: true, label: true, category: true },
    });
    const suggestion = suggestDocumentType(allTypes, file.name, extractedText);
    if (!suggestion) {
      return {
        error: "Type de document non détecté automatiquement — merci de le sélectionner.",
        needsManualType: true,
        candidates: allTypes.map(({ id, label, category }) => ({ id, label, category })),
      };
    }
    documentTypeId = suggestion.documentTypeId;
  }

  const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!documentType) return { error: "Type de document invalide." };

  const document = await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    update: {},
    create: { establishmentId, documentTypeId, status: "MISSING" },
    include: {
      versions: { select: { versionNumber: true }, orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });

  const nextVersionNumber = (document.versions[0]?.versionNumber ?? 0) + 1;
  const storageKey = `${establishmentId}/${documentTypeId}/v${nextVersionNumber}-${Date.now()}-${file.name}`;

  const storage = getFileStoragePort();
  await storage.upload(storageKey, buffer, file.type);

  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber: nextVersionNumber,
      fileStorageKey: storageKey,
      originalFilename: file.name,
      uploadedByUserId: session.user.id,
      extractedText,
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { currentVersionId: version.id, status: "UPLOADED", statusOverriddenByUser: false },
  });

  revalidatePath("/dashboard/client");
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);

  return { success: true, documentTypeId };
}

async function getAuthorizedDocumentVersion(documentVersionId: string) {
  const session = await auth();
  if (!session) redirect("/login");

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    include: { document: { select: { establishmentId: true } } },
  });
  if (!version) return null;

  if (session.user.role === "CLIENT_USER") {
    const link = await prisma.establishmentUser.findUnique({
      where: {
        userId_establishmentId: {
          userId: session.user.id,
          establishmentId: version.document.establishmentId,
        },
      },
    });
    if (!link) return null;
  }

  return version;
}

export async function getDocumentDownloadUrl(documentVersionId: string): Promise<string | null> {
  const version = await getAuthorizedDocumentVersion(documentVersionId);
  if (!version) return null;

  const storage = getFileStoragePort();
  return storage.getSignedDownloadUrl(version.fileStorageKey, {
    disposition: "attachment",
    filename: version.originalFilename,
  });
}

// Un navigateur ne sait afficher nativement qu'un PDF — un .docx est toujours
// proposé au téléchargement par le système, quel que soit le Content-Disposition.
// Pour les .docx, l'aperçu affiche donc le texte déjà extrait à l'upload
// (mammoth, cf. text-extraction-service) plutôt que le fichier brut.
export type DocumentPreviewData =
  | { kind: "pdf"; url: string; filename: string }
  | { kind: "text"; text: string; filename: string }
  | { kind: "unavailable"; filename: string };

export async function getDocumentPreviewData(
  documentVersionId: string
): Promise<DocumentPreviewData | null> {
  const version = await getAuthorizedDocumentVersion(documentVersionId);
  if (!version) return null;

  const isPdf = version.originalFilename.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    const storage = getFileStoragePort();
    const url = await storage.getSignedDownloadUrl(version.fileStorageKey, {
      disposition: "inline",
      filename: version.originalFilename,
    });
    return { kind: "pdf", url, filename: version.originalFilename };
  }

  if (version.extractedText) {
    return { kind: "text", text: version.extractedText, filename: version.originalFilename };
  }

  return { kind: "unavailable", filename: version.originalFilename };
}
