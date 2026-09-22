"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STORAGE_KEY, applyTheme, resolveInitialTheme, type Theme } from "./theme-storage";

// Bascule clair/sombre manuelle (Damon, 22/09/2026) : jusqu'ici le mode sombre ne
// suivait QUE la préférence système (globals.css), sans bouton nulle part. Rendu
// dans AppHeader — le seul bandeau commun aux deux espaces (cabinet ET client),
// donc un seul composant couvre les deux sans duplication.
//
// `theme` reste `null` jusqu'au montage : le serveur ne connaît ni la préférence
// système ni le choix stocké en localStorage, donc rien de fiable à rendre avant
// l'hydratation. Un bouton qui changerait d'icône une frame après le premier rendu
// serait plus visible qu'un bouton simplement absent le temps du montage.
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveInitialTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  if (theme === null) {
    // Même emplacement, même taille : réserver la place évite un bandeau qui
    // se redimensionne d'une frame à l'autre au montage.
    return <span className="inline-block h-11 w-11" aria-hidden="true" />;
  }

  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="text-[#F0E8DC] hover:text-[#D69646] hover:bg-white/10"
      title={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
