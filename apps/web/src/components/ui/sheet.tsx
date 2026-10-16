"use client";

import { DialogFrame } from "./dialog-frame";

// Panneau latéral de 480 px (maquettes v2 : détail d'un document, d'une tâche),
// pleine largeur sur mobile. Même comportement qu'une modale (DialogFrame) : le
// reste de l'écran est inerte tant que le panneau est ouvert.
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <DialogFrame variant="sheet" title={title} onClose={onClose}>
      {children}
    </DialogFrame>
  );
}
