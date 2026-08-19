"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { requireEstablishmentAccess, tryEstablishmentAccess } from "@/lib/auth/guards";
import { extractText } from "@/lib/services/text-extraction-service";
import { suggestDocumentType } from "@/lib/services/document-categorization-service";
import { ingestDocumentVersion } from "@/lib/services/document-ingestion-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { validateUploadedFile } from "@/lib/security/upload-validation-service";
import { getFileStoragePort } from "@/lib/storage";
import { getLLMAnalysisPort } from "@/lib/llm";

// Cette action reste volontairement mince : autorisation → validation → délégation
// au service d'ingestion → invalidation de cache. La séquence métier (versioning,
// stockage, analyse) vit dans document-ingestion-service.ts.

export type DocumentTypeCandidate = { id: string; label: string; category: string };

export type UploadDocumentResult =
  | { success: true; documentTypeId: string }
  | { error: string; needsManualType?: true; candidates?: DocumentTypeCandidate[] };

function revalidateDocumentViews(establishmentId: string): void {
  revalidatePath("/dashboard/client");
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
}

export async function uploadDocument(formData: FormData): Promise<UploadDocumentResult> {
  const establishmentId = formData.get("establishmentId");
  if (typeof establishmentId !== "string" || establishmentId.length === 0) {
    return { error: "Établissement manquant." };
  }

  // Autorisation avant toute lecture du fichier : ne jamais dépenser de l'I/O ni de
  // l'extraction de texte pour un appelant non habilité sur cet établissement.
  const access = await requireEstablishmentAccess(establishmentId);

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Aucun fichier sélectionné." };

  const buffer = Buffer.from(await file.arrayBuffer());

  // Le type réel est déterminé par la signature binaire, jamais par `file.type`
  // (valeur fournie par le client, donc falsifiable).
  const validation = validateUploadedFile(buffer, file.size);
  if (!validation.ok) return { error: validation.error };

  const extractedText = await extractText(buffer, validation.contentType);

  const requestedTypeId = formData.get("documentTypeId");
  let documentTypeId = typeof requestedTypeId === "string" && requestedTypeId ? requestedTypeId : null;

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

  const result = await ingestDocumentVersion(
    {
      establishmentId,
      documentTypeId: documentType.id,
      documentTypeLabel: documentType.label,
      content: buffer,
      contentType: validation.contentType,
      originalFilename: file.name,
      uploadedByUserId: access.userId,
      extractedText,
    },
    { storage: getFileStoragePort(), llm: getLLMAnalysisPort() }
  );

  await recordAuditEvent({
    action: "DOCUMENT_UPLOADED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: result.documentVersionId,
    detail: documentType.code,
  });

  revalidateDocumentViews(establishmentId);

  return { success: true, documentTypeId: documentType.id };
}

// Réponse Oui/Non + commentaire libre pour un document pas encore déposé —
// "Non" (ne concerne pas l'établissement) bascule le statut en NOT_APPLICABLE ;
// "Oui" (concerne l'établissement mais pas encore fourni) garde MISSING. Le
// commentaire est conservé dans les deux cas comme élément de preuve exploitable
// en cotation (Module 3).
const MAX_JUSTIFICATION_LENGTH = 2000;

export async function respondToMissingDocument(
  establishmentId: string,
  documentTypeId: string,
  applies: boolean,
  comment: string | null
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId);

  const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!documentType) return { error: "Type de document invalide." };

  const trimmedComment = comment?.trim().slice(0, MAX_JUSTIFICATION_LENGTH) || null;
  const status = applies ? "MISSING" : "NOT_APPLICABLE";

  await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    update: { status, missingJustification: trimmedComment, statusOverriddenByUser: !applies },
    create: {
      establishmentId,
      documentTypeId,
      status,
      missingJustification: trimmedComment,
      statusOverriddenByUser: !applies,
    },
  });

  await recordAuditEvent({
    action: "DOCUMENT_STATUS_ANSWERED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentType.id,
    detail: `${documentType.code} → ${status}`,
  });

  revalidateDocumentViews(establishmentId);
  return null;
}

// Résout une version de document en vérifiant l'habilitation sur SON établissement
// (et non sur un identifiant fourni par l'appelant) — c'est ce qui empêche de
// deviner un `documentVersionId` appartenant à un autre établissement.
async function getAuthorizedDocumentVersion(documentVersionId: string) {
  if (typeof documentVersionId !== "string" || documentVersionId.length === 0) return null;

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    include: { document: { select: { establishmentId: true, documentType: { select: { code: true } } } } },
  });
  if (!version) return null;

  const access = await tryEstablishmentAccess(version.document.establishmentId);
  if (!access) return null;

  return { version, access };
}

export async function getDocumentDownloadUrl(documentVersionId: string): Promise<string | null> {
  const authorized = await getAuthorizedDocumentVersion(documentVersionId);
  if (!authorized) return null;

  const { version, access } = authorized;

  await recordAuditEvent({
    action: "DOCUMENT_DOWNLOADED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: version.document.documentType?.code ?? null,
  });

  return getFileStoragePort().getSignedDownloadUrl(version.fileStorageKey, {
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
  const authorized = await getAuthorizedDocumentVersion(documentVersionId);
  if (!authorized) return null;

  const { version, access } = authorized;

  await recordAuditEvent({
    action: "DOCUMENT_PREVIEWED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: version.document.documentType?.code ?? null,
  });

  const isPdf = version.originalFilename.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    const url = await getFileStoragePort().getSignedDownloadUrl(version.fileStorageKey, {
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
