import { getFileStoragePort } from "@/lib/storage";
import { isImageFile, isPdfFile } from "./file-type-service";
import type { FilePreviewData } from "./file-preview-types";

// Un seul endroit pour décider COMMENT prévisualiser un fichier déposé — documents
// clients (document.ts) et bibliothèque de modèles (template-library.ts) faisaient
// exactement le même choix pdf/texte/indisponible, chacun de son côté (D1).
//
// Corrige le retour du 15/09/2026 : « Voir » affichait le texte brut extrait par
// l'IA à la place du document d'origine, pour tout ce qui n'était pas un PDF —
// y compris une image déposée telle quelle (charte, organigramme photographiés).
//
// Second corrigé, du 16/10/2026 — décision de Damon : un `.docx` s'affichait en
// Markdown formaté (titres, tableaux, « [Image 1] » à la place des images), ce qui
// reste un texte, pas un document. Depuis, ce qui se convertit est rendu en PAGES
// (`kind: "document"`, cf. document-pdf-service) : le lecteur du navigateur affiche
// le document comme un document. L'aperçu Markdown reste le REPLI, pour les formats
// qu'aucun convertisseur ne prend en charge — mieux vaut du texte que rien.
export { isImageFile };

export async function buildFilePreview(params: {
  originalFilename: string;
  fileStorageKey: string;
  extractedText: string | null;
  // Adresse des pages servies par la plateforme (`/api/documents/{versionId}/pdf`).
  // L'appelant la fournit quand le format se convertit (`canRenderDocumentPages`) ;
  // `null` quand il n'y a pas de route pour ce fichier (bibliothèque de modèles, ou
  // format sans convertisseur). La décision de convertir est PRISE PAR L'APPELANT,
  // une seule fois — ici on ne fait que la suivre, comme pour `.pdf` et les images,
  // qui sont reconnus au nom sans vérifier le contenu (le rendu, lui, détecte par
  // signature et refuse ce qu'il ne sait pas lire).
  documentPagesUrl: string | null;
}): Promise<FilePreviewData> {
  const { originalFilename, fileStorageKey, extractedText, documentPagesUrl } = params;

  if (isPdfFile(originalFilename)) {
    const url = await getFileStoragePort().getSignedDownloadUrl(fileStorageKey, {
      disposition: "inline",
      filename: originalFilename,
    });
    return { kind: "pdf", url, filename: originalFilename };
  }

  if (isImageFile(originalFilename)) {
    const url = await getFileStoragePort().getSignedDownloadUrl(fileStorageKey, {
      disposition: "inline",
      filename: originalFilename,
    });
    return { kind: "image", url, filename: originalFilename };
  }

  if (documentPagesUrl) {
    return { kind: "document", url: documentPagesUrl, filename: originalFilename };
  }

  if (extractedText) {
    return { kind: "markdown", text: extractedText, filename: originalFilename };
  }

  return { kind: "unavailable", filename: originalFilename };
}
