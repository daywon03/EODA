import { getFileStoragePort } from "@/lib/storage";
import { isImageFile } from "./file-type-service";
import type { FilePreviewData } from "./file-preview-types";

// Un seul endroit pour décider COMMENT prévisualiser un fichier déposé — documents
// clients (document.ts) et bibliothèque de modèles (template-library.ts) faisaient
// exactement le même choix pdf/texte/indisponible, chacun de son côté (D1).
//
// Corrige le retour du 15/09/2026 : « Voir » affichait le texte brut extrait par
// l'IA à la place du document d'origine, pour tout ce qui n'était pas un PDF —
// y compris une image déposée telle quelle (charte, organigramme photographiés).
// Un navigateur ne sait toujours afficher nativement qu'un PDF ; mais une image
// se sert elle-même (URL signée), et un .docx/.xlsx se rend maintenant en
// Markdown formaté plutôt qu'en texte brut (cf. FilePreviewModal) — pas une
// fidélité de mise en page totale, mais un document qui se lit, avec ses titres,
// ses tableaux et ses images inline.
function hasExtension(filename: string, extensions: string[]): boolean {
  const lower = filename.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export { isImageFile };

export async function buildFilePreview(params: {
  originalFilename: string;
  fileStorageKey: string;
  extractedText: string | null;
}): Promise<FilePreviewData> {
  const { originalFilename, fileStorageKey, extractedText } = params;

  if (hasExtension(originalFilename, [".pdf"])) {
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

  if (extractedText) {
    return { kind: "markdown", text: extractedText, filename: originalFilename };
  }

  return { kind: "unavailable", filename: originalFilename };
}
