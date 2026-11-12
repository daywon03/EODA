import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { tryEstablishmentAccess } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { canOpenDocumentFile, documentFileOpenerOf } from "@/lib/auth/document-file-access";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { signedCopyHeaders, signedCopyType } from "@/lib/services/document-original-response";
import { signedFilename } from "@/lib/services/document-signature-service";
import { getFileStoragePort } from "@/lib/storage";

// ─────────────────────────────────────────────────────────────────────────────
// LA COPIE SIGNÉE ET TAMPONNÉE d'une version (12/11/2026), en pièce jointe.
//
// Mêmes portes que l'original (`canOpenDocumentFile`) : la structure et le cabinet —
// décision de Damon du 12/11 : EODA voit la version tamponnée, c'est le document final.
// Type décidé par SIGNATURE (Word ou PDF seulement), téléchargement journalisé.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ versionId: string }> };

export async function GET(_request: Request, context: Context): Promise<Response> {
  const { versionId } = await context.params;

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      originalFilename: true,
      signedFileStorageKey: true,
      uploadedBy: { select: { role: true } },
      document: { select: { establishmentId: true, validatedAt: true, documentType: { select: { code: true } } } },
    },
  });
  if (!version?.signedFileStorageKey) notFound();

  const access = await tryEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_READ);
  if (!access) notFound();
  if (
    !canOpenDocumentFile(documentFileOpenerOf(access), {
      documentTypeCode: version.document.documentType?.code,
      producedByCabinet: version.uploadedBy.role !== "CLIENT_USER",
      validatedAt: version.document.validatedAt,
    })
  ) {
    notFound();
  }

  const content = await getFileStoragePort().download(version.signedFileStorageKey);
  const type = signedCopyType(content);
  if (!type) notFound();

  await recordAuditEvent({
    action: "DOCUMENT_DOWNLOADED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: `${version.document.documentType?.code ?? "?"} · copie signée`,
  });

  return new Response(new Uint8Array(content), { headers: signedCopyHeaders(type, signedFilename(version.originalFilename)) });
}
