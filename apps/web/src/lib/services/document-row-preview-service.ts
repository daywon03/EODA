import { canRenderDocumentPages, isImageFile, isPdfFile } from "./file-type-service";
import type { FilePreviewData } from "./file-preview-types";

// ─────────────────────────────────────────────────────────────────────────────
// L'APERÇU D'UNE LIGNE DE DOCUMENT, DÉCIDÉ SANS ALLER AU SERVEUR (20/10/2026)
//
// Retour de Damon : « quand on appuie sur le document on veut directement la preview,
// je ne dois pas devoir appuyer une deuxième fois sur Voir ». Le geste d'ouverture
// passait par une action serveur (`getDocumentPreviewData`) : un aller-retour avant
// même de savoir ce qu'on allait montrer, donc un clic qui ne fait rien pendant
// quelques centaines de millisecondes, puis un second clic.
//
// Les trois formats se décident pourtant SANS requête :
//   - `.docx` / `.xlsx` / `.csv` : l'adresse des pages est notre propre route,
//     `/api/documents/{versionId}/pdf`, construite à partir d'un identifiant que la
//     ligne porte déjà (la route garde l'accès et journalise, cf. son en-tête) ;
//   - `.pdf` et images : le navigateur les affiche depuis le stockage, mais
//     l'adresse est SIGNÉE donc à durée de vie courte — elle est pré-signée côté
//     serveur au rendu de la page (`document-preview-urls-service`) et passée ici ;
//   - `.doc` / `.xls` : aucun convertisseur, donc aucun aperçu — c'est l'appelant
//     qui retombe sur le panneau, jamais une promesse en l'air.
//
// Rien ici ne lit un fichier ni ne touche au stockage : c'est la même décision que
// `buildFilePreview` (qui, elle, signe l'URL), restreinte à ce qu'un clic peut
// connaître à l'avance. Une seule règle de format, la même des deux côtés
// (`file-type-service`), pour que « Voir » et le clic sur la ligne ne divergent pas.
// ─────────────────────────────────────────────────────────────────────────────

export type PreviewableVersion = { id: string; originalFilename: string } | null;

/** L'adresse des pages rendues côté serveur pour une version (route gardée). */
export function documentPagesUrlFor(versionId: string): string {
  return `/api/documents/${versionId}/pdf`;
}

export function previewForVersion(
  version: PreviewableVersion,
  signedUrls: Readonly<Record<string, string>> = {}
): FilePreviewData | null {
  if (!version) return null;
  const { id, originalFilename } = version;

  if (isPdfFile(originalFilename) || isImageFile(originalFilename)) {
    // Sans adresse signée, on ne fabrique pas une URL : le geste « Voir » du panneau
    // la redemandera. Mieux vaut ouvrir le panneau seul qu'un cadre qui échouera.
    const url = signedUrls[id];
    if (!url) return null;
    return {
      kind: isPdfFile(originalFilename) ? "pdf" : "image",
      url,
      filename: originalFilename,
    };
  }

  if (canRenderDocumentPages(originalFilename)) {
    return {
      kind: "document",
      url: documentPagesUrlFor(id),
      filename: originalFilename,
    };
  }

  return null;
}
