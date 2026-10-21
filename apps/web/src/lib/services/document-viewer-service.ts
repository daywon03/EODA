import { canRenderDocumentPages, isImageFile, isPdfFile } from "./file-type-service";

// ─────────────────────────────────────────────────────────────────────────────
// CE QUE LA VISIONNEUSE AFFICHE, décidé SANS aller-retour serveur (21/10/2026).
//
// Retour de Damon et Sandrine : ouvrir un document prenait du temps, il fallait
// cliquer une seconde fois sur « Voir », et fermer reprenait le même temps. Le
// premier coût venait de là : l'adresse de l'aperçu n'existait qu'après une action
// serveur (`getDocumentPreviewData`, qui signe une URL de stockage). Ici, l'adresse
// se CALCULE du seul identifiant de version — elle désigne une route de la plateforme
// qui contrôle l'accès et journalise au moment de servir les octets. La visionneuse
// peut donc s'ouvrir et commencer à charger dès le clic.
//
// Module pur, sans dépendance serveur : importé par des composants client.
//
// Le nom du fichier décide de l'affichage (comme `buildFilePreview`) ; la route, elle,
// re-vérifie le type par SIGNATURE et refuse ce qui ne correspond pas.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentViewerSource =
  // Le PDF déposé, servi tel quel : le lecteur du navigateur l'affiche.
  | { kind: "pdf"; url: string }
  // Une photo déposée, servie telle quelle — jamais via Chromium, qui la transformait
  // en PDF de 22 Mo en 5 s pour un simple affichage (mesuré le 21/10/2026).
  | { kind: "image"; url: string }
  // Word, Excel, CSV : les PAGES produites côté serveur (cf. document-pdf-service).
  | { kind: "pages"; url: string; prepareUrl: string }
  // `.doc` / `.xls` et formats sans convertisseur : la visionneuse demande le repli
  // (texte extrait) à l'action serveur existante.
  | { kind: "fallback" };

export function documentOriginalUrl(versionId: string): string {
  return `/api/documents/${encodeURIComponent(versionId)}/original`;
}

export function documentPagesUrl(versionId: string): string {
  return `/api/documents/${encodeURIComponent(versionId)}/pdf`;
}

// Prépare les pages en cache sans servir d'octets (réponse 204) : appelé au survol
// d'une ligne et après un dépôt, pour que le clic tombe sur le cache.
export function documentPagesPrepareUrl(versionId: string): string {
  return `${documentPagesUrl(versionId)}?prepare=1`;
}

// Prépare, en tâche de fond, les pages d'un Word / Excel / CSV (sans effet pour un PDF
// ou une photo, servis tels quels). Rend `true` si une préparation est partie. Un échec
// n'a aucune conséquence visible : le clic rendra les pages lui-même, plus lentement.
// Une seule définition, utilisée au survol (DocumentWorkspace) et après un dépôt
// (DocumentUploadButton) — D1.
export function prepareDocumentPages(versionId: string, originalFilename: string): boolean {
  const source = documentViewerSource(versionId, originalFilename);
  if (source.kind !== "pages") return false;
  void fetch(source.prepareUrl, { credentials: "same-origin" }).catch(() => undefined);
  return true;
}

export function documentViewerSource(versionId: string, originalFilename: string): DocumentViewerSource {
  if (isPdfFile(originalFilename)) return { kind: "pdf", url: documentOriginalUrl(versionId) };
  if (isImageFile(originalFilename)) return { kind: "image", url: documentOriginalUrl(versionId) };
  if (canRenderDocumentPages(originalFilename)) {
    return { kind: "pages", url: documentPagesUrl(versionId), prepareUrl: documentPagesPrepareUrl(versionId) };
  }
  return { kind: "fallback" };
}
