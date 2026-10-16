"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOCUSABLE_SELECTOR, focusTrapTarget } from "@/lib/design/keyboard-navigation";

// Socle commun de Modal et Sheet — une seule implémentation du comportement de
// fenêtre (D1) : portail, `aria-modal`, nom par `aria-labelledby`, Échap, piège à
// focus, focus initial dans la fenêtre et RESTITUÉ à l'élément d'origine à la
// fermeture, défilement de la page bloqué. Aucune dépendance (pas de Radix Dialog
// dans le dépôt) : la logique de tabulation est pure et testée
// (lib/design/keyboard-navigation.ts).

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Disposition : fenêtre centrée ou panneau latéral.
  variant: "modal" | "sheet";
  panelClassName?: string;
};

function useDialogBehavior(panel: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  // `onClose` change à chaque rendu chez la plupart des appelants : on lit la
  // dernière version sans relancer l'effet (sinon le focus repartirait au début).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
    (focusables()[0] ?? panel.current)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const target = focusTrapTarget(current, items.length, event.shiftKey);
      if (target === null) return;
      event.preventDefault();
      items[target]?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [panel]);
}

export function DialogFrame({ title, onClose, children, variant, panelClassName }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useDialogBehavior(panel, onClose);

  const isSheet = variant === "sheet";
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex bg-ink-fill/60 animate-fade-in",
        isSheet ? "justify-end" : "items-center justify-center p-4"
      )}
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex flex-col overflow-hidden bg-card text-ink shadow-eoda-lg",
          isSheet ? "h-full w-full max-w-[480px] border-l border-line" : "max-h-[85vh] w-full rounded-xl",
          panelClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink2 hover:bg-soft hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
