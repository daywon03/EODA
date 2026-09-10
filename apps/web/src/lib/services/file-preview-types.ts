// Forme partagée par tout aperçu de fichier dans la plateforme — documents clients
// (lib/actions/document.ts) et bibliothèque de modèles (lib/actions/template-library.ts) —
// et par la modale qui l'affiche (components/shared/FilePreviewModal.tsx). Un seul
// endroit pour cette forme (D1) : les deux actions produisent la même chose, la
// modale n'a qu'une version à savoir rendre.
export type FilePreviewData =
  | { kind: "pdf"; url: string; filename: string }
  | { kind: "text"; text: string; filename: string }
  | { kind: "unavailable"; filename: string };
