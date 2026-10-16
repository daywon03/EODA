"use client";

import { DialogFrame } from "./dialog-frame";

// Fenêtre modale générique, centrée. Le comportement (piège à focus, Échap,
// `aria-labelledby`, restitution du focus) vit dans DialogFrame, partagé avec Sheet.
// FilePreviewModal reste à part : son gabarit est spécifique à l'aperçu d'un
// fichier (iframe/image/markdown).
export function Modal({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  // Les formulaires hébergés n'ont pas la même largeur naturelle — l'import de
  // dossier affiche un tableau de lignes, les autres un simple formulaire.
  maxWidthClassName?: string;
}) {
  return (
    <DialogFrame variant="modal" title={title} onClose={onClose} panelClassName={maxWidthClassName}>
      {children}
    </DialogFrame>
  );
}
