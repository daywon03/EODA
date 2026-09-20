"use client";

import dynamic from "next/dynamic";
import type { FilePreviewData } from "@/lib/services/file-preview-types";

// `react-markdown` + `remark-gfm` ne servent QU'À l'intérieur de l'aperçu, c'est-à-dire
// après un clic sur « Voir ». Importés statiquement, ils voyageaient dans la première
// charge des quatre écrans qui portent ce bouton — fiche client, portail client,
// livrables, bibliothèque de modèles — et trois d'entre eux passaient au-dessus de leur
// budget de route (`pnpm check:bundle`, convention P9 : ce qui est lourd et rare se
// charge à la demande).
//
// `ssr: false` parce que la modale se monte dans un portail sur `document.body` : elle
// n'a rien à rendre côté serveur.
//
// Un seul endroit pour ce découpage, partagé par DocumentPreviewLink et
// TemplatePreviewLink (D1) : deux `dynamic()` séparés produiraient deux chunks du même
// module, et le jour où l'un des deux repasse en import statique, le budget retomberait
// sans que personne ne sache lequel.
export const FilePreviewModal = dynamic(
  () => import("./FilePreviewModal").then((m) => m.FilePreviewModal),
  { ssr: false },
);

// Appelée au clic, en parallèle de l'action serveur qui va chercher le contenu : sans
// elle, le chargement du chunk ne démarrerait qu'une fois la réponse revenue, et
// s'ajouterait à l'attente au lieu de s'y fondre.
export function preloadFilePreviewModal(): void {
  void import("./FilePreviewModal");
}

export type { FilePreviewData };
