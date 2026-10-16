import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { tryCabinetSession } from "@/lib/auth/guards";
import { getOrRenderDocumentPdf } from "@/lib/services/document-pdf-service";
import {
  documentPdfErrorResponse,
  documentPdfFilename,
  documentPdfPreviewFailureMessage,
} from "@/lib/services/document-pdf-response";

// ─────────────────────────────────────────────────────────────────────────────
// LES PAGES D'UN DOCUMENT DE LA BIBLIOTHÈQUE DE MODÈLES — même rendu que les
// documents clients (`/api/documents/[versionId]/pdf`), même service, donc le même
// aperçu paginé dans la même modale (D1).
//
// Réservé au CABINET : la bibliothèque est interne. `tryCabinetSession` plutôt que
// `requireCabinetSession` — une route répond, elle ne redirige pas : un `redirect()`
// ici ferait afficher la page de connexion DANS le cadre d'aperçu, ce qui donnerait
// à croire que le document est vide.
//
// Pas de journal d'audit : la bibliothèque de modèles n'est pas une pièce versée à un
// dossier d'établissement — même choix que `getTemplateVersionPreviewData`, qui n'en
// pose pas non plus.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = { params: Promise<{ versionId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { versionId } = await context.params;

  const cabinet = await tryCabinetSession("LIBRARY_READ");
  if (!cabinet) notFound();

  // Le périmètre du tenant est DANS la requête : une version d'un autre cabinet
  // n'existe pas, plutôt que d'exister et d'être refusée après coup.
  const version = await prisma.templateVersion.findFirst({
    where: { id: versionId, templateDocument: { tenantId: cabinet.tenantId } },
    select: {
      id: true,
      originalFilename: true,
      fileStorageKey: true,
      versionLabel: true,
      templateDocument: { select: { title: true } },
    },
  });
  if (!version) notFound();

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = documentPdfFilename(version.originalFilename);

  let pdf: Buffer | null;
  try {
    pdf = await getOrRenderDocumentPdf({
      versionId: version.id,
      originalFilename: version.originalFilename,
      fileStorageKey: version.fileStorageKey,
      title: version.templateDocument.title,
      subtitle: version.versionLabel
        ? `${version.versionLabel} · ${version.originalFilename}`
        : version.originalFilename,
    });
  } catch (error) {
    console.error(
      "Aperçu de modèle — rendu échoué :",
      error instanceof Error ? error.message : "erreur inconnue"
    );
    return documentPdfErrorResponse(503, documentPdfPreviewFailureMessage(error));
  }

  if (!pdf) {
    return documentPdfErrorResponse(
      404,
      "Aucun aperçu paginé n'est disponible pour ce document — téléchargez-le dans son format d'origine."
    );
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

