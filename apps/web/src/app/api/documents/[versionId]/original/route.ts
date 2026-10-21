import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { tryEstablishmentAccess } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { getFileStoragePort } from "@/lib/storage";
import { inlineOriginalHeaders, inlineOriginalType } from "@/lib/services/document-original-response";
import { documentPdfErrorResponse } from "@/lib/services/document-pdf-response";

// ─────────────────────────────────────────────────────────────────────────────
// L'ORIGINAL D'UN PDF OU D'UNE PHOTO, pour la visionneuse (21/10/2026).
//
// La visionneuse calcule cette adresse du seul identifiant de version
// (`document-viewer-service`) : elle s'ouvre et commence à charger dès le clic, sans
// attendre qu'une action serveur lui signe une URL de stockage. Le contrôle d'accès et
// la journalisation se font ICI, au moment où les octets partent — un accès, une ligne.
//
// Seuls PDF, JPEG et PNG reconnus par signature sont servis
// (`document-original-response`) : le reste a son propre chemin (pages produites par
// `/pdf`, ou texte extrait).
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
      fileStorageKey: true,
      document: { select: { establishmentId: true, documentType: { select: { code: true } } } },
    },
  });
  if (!version) notFound();

  // L'habilitation porte sur l'établissement PROPRIÉTAIRE de la version, jamais sur un
  // identifiant fourni. Le client y a droit : c'est son document.
  const access = await tryEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_READ);
  if (!access) notFound();

  const content = await getFileStoragePort().download(version.fileStorageKey);
  const type = inlineOriginalType(content);
  if (!type) {
    return documentPdfErrorResponse(
      404,
      "Ce fichier ne s'affiche pas tel quel — téléchargez-le dans son format d'origine."
    );
  }

  await recordAuditEvent({
    action: "DOCUMENT_PREVIEWED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: version.document.documentType?.code ?? null,
  });

  return new Response(new Uint8Array(content), { headers: inlineOriginalHeaders(type, version.originalFilename) });
}
