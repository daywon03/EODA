"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { STORAGE_KEY, applyTheme, resolveInitialTheme, type Theme } from "./theme-storage";

// Bascule clair/sombre manuelle (Damon, 22/09/2026). Rendue dans l'en-tête des deux
// coquilles (cabinet et client) : un seul composant pour les deux.
//
// Le texte visible EST le nom accessible (« Mode sombre ») : pas d'aria-label qui
// dirait autre chose que ce qu'on lit (WCAG 2.5.3). Sur petit écran le texte passe
// en lecture d'écran seulement, l'icône reste.
//
// `theme` reste `null` jusqu'au montage : le serveur ne connaît ni la préférence
// système ni le choix stocké, donc rien de fiable à rendre avant l'hydratation.
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(resolveInitialTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Stockage refusé (navigation privée) : le thème change pour cette page.
    }
    applyTheme(next);
  }

  const base = cn(
    "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 text-base text-ink transition-colors hover:border-accent-text",
    className
  );

  if (theme === null) {
    // Même emplacement, même taille : pas de bandeau qui se redimensionne au montage.
    return <span className={cn(base, "invisible")} aria-hidden="true" />;
  }

  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  return (
    <button type="button" onClick={toggle} className={base}>
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{isDark ? "Mode clair" : "Mode sombre"}</span>
    </button>
  );
}
