import { notFound } from "next/navigation";
import { prisma } from "@eoda/database";
import { tryEstablishmentAccess } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { isVersionVisibleToClient } from "@/lib/services/deliverables-service";
import { getOrRenderDocumentPdf } from "@/lib/services/document-pdf-service";
import {
  documentPdfErrorResponse,
  documentPdfFilename,
  documentPdfPreviewFailureMessage,
} from "@/lib/services/document-pdf-response";

// ─────────────────────────────────────────────────────────────────────────────
// LES PAGES D'UN DOCUMENT DÉPOSÉ — route et non action serveur, mêmes raisons que
// `/api/documents/[versionId]/draft-docx` : le binaire ne traverse pas proprement un
// retour d'action serveur.
//
// Elle sert DEUX usages, avec le même rendu (document-pdf-service) :
//   - l'APERÇU : la modale « Voir » pointe un `<iframe>` ici, le navigateur affiche
//     le PDF avec son propre lecteur (vignettes, « 1 / 6 », zoom, rotation) ;
//   - l'EXPORT PDF : `?download=1` fait partir le même fichier en pièce jointe.
//
// Pourquoi une route et pas une URL signée : le `.docx` n'est pas un PDF, il n'existe
// aucune adresse du stockage qui puisse l'afficher. Le contenu est lu côté serveur,
// converti, et servi depuis nos propres gardes — la pièce ne sort jamais autrement
// que par un contrôle d'accès, et l'accès se journalise ici.
//
// `maxDuration` : le premier aperçu d'un document coûte un lancement de Chromium.
// Les suivants sont servis par le cache de rendu.
// ─────────────────────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Context = { params: Promise<{ versionId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  const { versionId } = await context.params;

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: {
      id: true,
      originalFilename: true,
      fileStorageKey: true,
      versionNumber: true,
      uploadedBy: { select: { role: true } },
      document: {
        select: {
          establishmentId: true,
          validatedAt: true,
          documentType: { select: { code: true, label: true } },
        },
      },
    },
  });
  if (!version) notFound();

  // L'identifiant vient d'une route HTTP publique : l'habilitation porte sur
  // l'établissement PROPRIÉTAIRE de la version, jamais sur un identifiant fourni.
  // Le client y a droit — c'est SON document, et son portail a le même bouton.
  const access = await tryEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_READ);
  if (!access) notFound();

  // Un brouillon produit par EODA n'est pas restituable avant validation du document
  // (deliverables-service). La structure reçoit les identifiants des versions dans sa
  // page : la route doit refuser, pas seulement la carte cacher le bouton.
  if (
    access.isClient &&
    !isVersionVisibleToClient({
      producedByCabinet: version.uploadedBy.role !== "CLIENT_USER",
      validatedAt: version.document.validatedAt,
    })
  ) {
    notFound();
  }

  const download = new URL(request.url).searchParams.get("download") === "1";

  // Journalisé AVANT le rendu : l'accès a eu lieu, même si la conversion échoue
  // ensuite. C'est ce que la modale ne peut pas journaliser elle-même (elle ne remet
  // qu'une adresse, cf. getDocumentPreviewData) — un accès, une ligne.
  await recordAuditEvent({
    action: download ? "DOCUMENT_DOWNLOADED" : "DOCUMENT_PREVIEWED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: version.document.documentType?.code ?? null,
  });

  const filename = documentPdfFilename(version.originalFilename);

  let pdf: Buffer | null;
  try {
    pdf = await getOrRenderDocumentPdf({
      versionId: version.id,
      originalFilename: version.originalFilename,
      fileStorageKey: version.fileStorageKey,
      // L'INTITULÉ du type (« Livret d'accueil »), jamais le nom du fichier : c'est
      // ainsi que Sandrine nomme la pièce, et ce que la structure reconnaît.
      title: version.document.documentType?.label ?? "Document",
      subtitle: `Version ${version.versionNumber} · ${version.originalFilename}`,
    });
  } catch (error) {
    console.error(
      "Aperçu de document — rendu échoué :",
      error instanceof Error ? error.message : "erreur inconnue"
    );
    return documentPdfErrorResponse(503, documentPdfPreviewFailureMessage(error));
  }

  // Le format ne se convertit pas (`.doc`/`.xls`, ou un fichier dont la signature ne
  // correspond pas à son nom) : le dire, plutôt que de servir des pages vides.
  if (!pdf) {
    return documentPdfErrorResponse(
      404,
      "Aucun aperçu paginé n'est disponible pour ce document — téléchargez-le dans son format d'origine."
    );
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // Nom assaini (liste blanche ASCII, sans guillemet ni retour à la ligne) : un
      // nom d'origine concaténé tel quel dans un en-tête est une injection d'en-tête.
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      // `private` : un document d'établissement n'a rien à faire dans un cache
      // partagé. `no-store` : l'effacer doit le faire disparaître de l'écran.
      "Cache-Control": "private, no-store",
    },
  });
}

