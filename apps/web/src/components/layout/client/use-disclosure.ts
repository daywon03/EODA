"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Comportement commun des menus déroulants du portail client (compte, « Plus ») —
// une seule définition (D1). Motif « disclosure » : un bouton qui montre une liste
// de liens ordinaires, parcourus à la tabulation, plutôt qu'un role="menu" et ses
// flèches à réimplémenter. Échap referme et rend le focus au bouton ; un clic
// ailleurs ou un changement de page referment aussi.
export function useDisclosure() {
  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      button.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  return { isOpen, toggle: () => setIsOpen((open) => !open), root, button };
}
