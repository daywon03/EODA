"use server";

import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { NEED } from "@/lib/auth/capabilities";
import { requireEstablishmentAccess } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { isAcceptanceCurrent } from "@/lib/services/client-documents-view-service";
import { DEPARTEMENT_TAMPON_CODE } from "@/lib/services/awareness-sheet-links";
import { validateUploadOnServer } from "@/lib/security/office-archive-guard";
import { buildStorageKey, DOCX_MIME_TYPE, PDF_MIME_TYPE } from "@/lib/security/upload-validation-service";
import { getFileStoragePort } from "@/lib/storage";
import {
  DECLARATION_NOT_FOUND_MESSAGE,
  signableKind,
  signedFilename,
  SIGNING_REFUSAL_MESSAGES,
  signingRefusal,
  type SignableKind,
} from "@/lib/services/document-signature-service";
import { revalidateDocumentViews } from "./document-views-revalidation";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNER ET TAMPONNER UN DOCUMENT ACCEPTÉ (12/11/2026) — règles dans
// `document-signature-service.ts`.
//
// Le fichier est signé DANS LE NAVIGATEUR de la direction (le tampon, à accès restreint,
// n'y est lu que par la route `/original`, qui le lui ouvre à elle seule) ; le serveur
// reçoit la copie signée, la revérifie (signature binaire, même format que l'original,
// archive Office bornée) et la range SUR la version acceptée, une seule fois.
// ─────────────────────────────────────────────────────────────────────────────

const STALE_VERSION_MESSAGE = "Un nouveau dépôt est arrivé sur ce document : rechargez la page avant de signer.";

const EXPECTED_TYPE: Record<SignableKind, string> = { DOCX: DOCX_MIME_TYPE, PDF: PDF_MIME_TYPE };

export type DocumentSigningContext = {
  establishmentId: string;
  documentTypeId: string;
  documentLabel: string;
  versionId: string;
  filename: string;
  kind: SignableKind | null;
  signedAt: Date | null;
  // Vrai : une copie signée ICI existe. Faux avec `signedAt` posé : la direction a
  // déclaré le fichier déposé déjà signé (« Il est déjà signé »).
  hasSignedCopy: boolean;
  refusal: string | null;
  // Le DERNIER dépôt du tampon de la structure (même règle que la tablette — il n'est
  // jamais validé, EODA ne l'ouvre pas). null : aucun tampon déposé.
  tamponVersionId: string | null;
};

async function readSignableDocument(establishmentId: string, documentTypeId: string) {
  return prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    select: {
      clientAcceptedAt: true,
      documentType: { select: { code: true, label: true } },
      currentVersion: {
        select: { id: true, versionNumber: true, originalFilename: true, uploadedAt: true, signedAt: true, signedFileStorageKey: true },
      },
    },
  });
}

type SignableDocument = NonNullable<Awaited<ReturnType<typeof readSignableDocument>>>;
type Access = Awaited<ReturnType<typeof requireEstablishmentAccess>>;

function refusalFor(access: Access, document: SignableDocument): string | null {
  const version = document.currentVersion!;
  const refusal = signingRefusal({
    accessRole: access.clientAccessRole,
    canWrite: canDepositDocuments(access.missionAccess),
    documentTypeCode: document.documentType?.code,
    acceptanceCurrent: isAcceptanceCurrent({ clientAcceptedAt: document.clientAcceptedAt, versionUploadedAt: version.uploadedAt }),
    filename: version.originalFilename,
    alreadySigned: version.signedAt !== null,
  });
  return refusal ? SIGNING_REFUSAL_MESSAGES[refusal] : null;
}

// Garde commune : la STRUCTURE seulement (le cabinet ne signe jamais pour elle), sur un
// document de SA structure, qui a une version.
async function requireSignableDocument(establishmentId: unknown, documentTypeId: unknown) {
  if (typeof establishmentId !== "string" || typeof documentTypeId !== "string") notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  if (!access.isClient) notFound();
  const document = await readSignableDocument(establishmentId, documentTypeId);
  if (!document?.currentVersion) notFound();
  return { access, document, establishmentId, documentTypeId };
}

export async function getDocumentSigningContext(establishmentId: string, documentTypeId: string): Promise<DocumentSigningContext> {
  const { access, document } = await requireSignableDocument(establishmentId, documentTypeId);
  const version = document.currentVersion!;
  const refusal = refusalFor(access, document);

  const tampon = refusal
    ? null
    : await prisma.document.findFirst({
        where: { establishmentId, documentType: { code: DEPARTEMENT_TAMPON_CODE } },
        select: { currentVersionId: true },
      });

  return {
    establishmentId,
    documentTypeId,
    documentLabel: document.documentType?.label ?? version.originalFilename,
    versionId: version.id,
    filename: version.originalFilename,
    kind: signableKind(version.originalFilename),
    signedAt: version.signedAt,
    hasSignedCopy: version.signedFileStorageKey !== null,
    refusal,
    tamponVersionId: tampon?.currentVersionId ?? null,
  };
}

// Ce qui a été posé, pour le journal seulement (jamais le fichier, jamais une image).
function parseMarkCounts(value: FormDataEntryValue | null): { signatures: number; tampons: number } {
  const marks = typeof value === "string" ? value.split(",") : [];
  return {
    signatures: marks.filter((m) => m === "SIGNATURE").length,
    tampons: marks.filter((m) => m === "TAMPON").length,
  };
}

export async function saveSignedDocument(formData: FormData): Promise<{ error: string } | { signedAt: Date }> {
  const { access, document, establishmentId, documentTypeId } = await requireSignableDocument(
    formData.get("establishmentId"),
    formData.get("documentTypeId")
  );
  const version = document.currentVersion!;
  if (formData.get("versionId") !== version.id) return { error: STALE_VERSION_MESSAGE };

  const refusal = refusalFor(access, document);
  if (refusal) return { error: refusal };

  const marks = parseMarkCounts(formData.get("marks"));
  if (marks.signatures + marks.tampons === 0) return { error: "Posez au moins une signature ou le tampon avant d'enregistrer." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Le document signé n'a pas été reçu." };
  const content = Buffer.from(await file.arrayBuffer());
  const validation = validateUploadOnServer(content, file.size);
  if (!validation.ok) return { error: validation.error };
  const kind = signableKind(version.originalFilename)!;
  if (validation.contentType !== EXPECTED_TYPE[kind]) {
    return { error: "Le document signé n'a pas le même format que l'original : rien n'a été enregistré." };
  }

  const key = buildStorageKey({
    establishmentId,
    documentTypeId,
    versionNumber: version.versionNumber,
    originalFilename: signedFilename(version.originalFilename),
    timestamp: Date.now(),
  });
  const storage = getFileStoragePort();
  await storage.upload(key, content, validation.contentType);

  const signedAt = new Date();
  // Posée UNE fois, et seulement si la version est toujours la courante : deux onglets
  // ou un dépôt arrivé entre-temps ne laissent jamais deux copies, ni une copie signée
  // sur une version remplacée.
  const updated = await prisma.documentVersion.updateMany({
    where: { id: version.id, signedAt: null, currentForDocument: { isNot: null } },
    data: { signedFileStorageKey: key, signedAt, signedByUserId: access.userId },
  });
  if (updated.count === 0) {
    try {
      await storage.delete(key);
    } catch (error) {
      console.error("Signature refusée : copie orpheline à supprimer du stockage :", error);
    }
    return { error: SIGNING_REFUSAL_MESSAGES.ALREADY_SIGNED };
  }

  await recordAuditEvent({
    action: "DOCUMENT_SIGNED_BY_CLIENT",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: version.id,
    detail: `${document.documentType?.code ?? "?"} · ${marks.signatures} signature(s), ${marks.tampons} tampon(s)`,
  });
  revalidateDocumentViews(establishmentId);
  return { signedAt };
}

// « Il est déjà signé » (12/11/2026) : le fichier déposé porte déjà la signature et le
// tampon. Mêmes portes que la signature (direction, mission active, accepté, version
// courante, pas déjà signé) ; `signedAt` posé SANS copie, par une écriture conditionnelle.
export async function declareDocumentAlreadySigned(formData: FormData): Promise<{ error: string } | { signedAt: Date }> {
  const { access, document, establishmentId } = await requireSignableDocument(
    formData.get("establishmentId"),
    formData.get("documentTypeId")
  );
  const version = document.currentVersion!;
  if (formData.get("versionId") !== version.id) return { error: STALE_VERSION_MESSAGE };
  const refusal = refusalFor(access, document);
  if (refusal) return { error: refusal };

  const signedAt = new Date();
  const updated = await prisma.documentVersion.updateMany({
    where: { id: version.id, signedAt: null, currentForDocument: { isNot: null } },
    data: { signedAt, signedByUserId: access.userId, signedFileStorageKey: null },
  });
  if (updated.count === 0) return { error: SIGNING_REFUSAL_MESSAGES.ALREADY_SIGNED };

  await recordAuditEvent({
    action: "DOCUMENT_SIGNED_BY_CLIENT",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: version.id,
    detail: `${document.documentType?.code ?? "?"} · déclaré déjà signé au dépôt`,
  });
  revalidateDocumentViews(establishmentId);
  return { signedAt };
}

// Retirer la déclaration (clic par erreur) : direction, mission active, et seulement une
// DÉCLARATION — une copie signée ici ne se retire pas par ce geste.
export async function withdrawAlreadySignedDeclaration(formData: FormData): Promise<{ error: string } | { ok: true }> {
  const { access, document, establishmentId } = await requireSignableDocument(
    formData.get("establishmentId"),
    formData.get("documentTypeId")
  );
  const version = document.currentVersion!;
  if (formData.get("versionId") !== version.id) return { error: STALE_VERSION_MESSAGE };
  if (access.clientAccessRole !== "DIRECTION") return { error: SIGNING_REFUSAL_MESSAGES.NOT_DIRECTION };
  if (!canDepositDocuments(access.missionAccess)) return { error: SIGNING_REFUSAL_MESSAGES.CLOSED };

  const updated = await prisma.documentVersion.updateMany({
    where: { id: version.id, signedAt: { not: null }, signedFileStorageKey: null, currentForDocument: { isNot: null } },
    data: { signedAt: null, signedByUserId: null },
  });
  if (updated.count === 0) return { error: DECLARATION_NOT_FOUND_MESSAGE };

  await recordAuditEvent({
    action: "DOCUMENT_SIGNED_BY_CLIENT",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: version.id,
    detail: `${document.documentType?.code ?? "?"} · déclaration « déjà signé » retirée`,
  });
  revalidateDocumentViews(establishmentId);
  return { ok: true };
}
