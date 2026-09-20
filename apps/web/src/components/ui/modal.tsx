"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Fenêtre modale générique — même mécanique que FilePreviewModal (portail, Échap,
// clic sur l'overlay), extraite ici pour ne pas la réécrire à chaque nouvel usage
// (D1). FilePreviewModal reste tel quel : son gabarit est spécifique à l'aperçu
// d'un fichier (iframe/image/markdown), pas réutilisable sans perdre en clarté.
export function Modal({
  title,
  onClose,
  children,
  maxWidthClassName = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  // Les trois formulaires hébergés (import de dossier, ajout de modèle, gestion des
  // dossiers) n'ont pas la même largeur naturelle — l'import affiche un tableau de
  // lignes, les deux autres un simple formulaire.
  maxWidthClassName?: string;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brun-ancre/60 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[85vh] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-xl bg-surface shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-gris-light px-5 py-3">
          <p className="text-sm font-semibold text-brun-ancre">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="cursor-pointer rounded-md p-1 text-gris-mid hover:text-brun-ancre"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
