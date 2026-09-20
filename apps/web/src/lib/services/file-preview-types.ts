// Forme partagée par tout aperçu de fichier dans la plateforme — documents clients
// (lib/actions/document.ts) et bibliothèque de modèles (lib/actions/template-library.ts) —
// et par la modale qui l'affiche (components/shared/FilePreviewModal.tsx). Un seul
// endroit pour cette forme (D1) : les deux actions produisent la même chose, la
// modale n'a qu'une version à savoir rendre.
export type FilePreviewData =
  | { kind: "pdf"; url: string; filename: string }
  | { kind: "image"; url: string; filename: string }
  // Rendu formaté (titres, tableaux, images inline si le document en contenait) —
  // pas le texte brut. Distinct de "text" : celui-ci reste réservé au comparateur
  // texte-extrait du cabinet (getExtractedText), qui doit montrer l'extraction
  // AU MOT PRÈS, sans mise en forme, pour repérer une extraction manquée.
  | { kind: "markdown"; text: string; filename: string }
  | { kind: "text"; text: string; filename: string }
  | { kind: "unavailable"; filename: string };
