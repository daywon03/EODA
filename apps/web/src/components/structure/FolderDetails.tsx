"use client";

import { useEffect, useState, type ReactNode } from "react";

// Un pavé de dossier (« Documents », cabinet et portail). Il garde l'état que la
// personne lui a donné : ouvrir un document du dossier puis le refermer ne doit pas
// replier le dossier (retour de Damon, 08/11/2026 — l'attribut `open` était recalculé
// par la page à chaque navigation, et retombait à « fermé » à la sortie du document).
// `forceOpen` ne fait qu'OUVRIR (recherche en cours, document du dossier affiché) :
// il ne referme jamais ce que la personne a ouvert.
export function FolderDetails({ forceOpen, className, summary, children }: {
  forceOpen: boolean;
  className?: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(forceOpen);
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className={className}>
      {summary}
      {children}
    </details>
  );
}
