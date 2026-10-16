"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  nextThemePreference,
  themePreferenceLabel,
  type ThemePreference,
} from "@/lib/design/theme-preference";
import { applyThemePreference, readThemePreference, storeThemePreference } from "./theme-storage";

const ICONS: Record<ThemePreference, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };

// Choix du thème (Damon, 22/09/2026), à trois états depuis le 12/10/2026 : clair,
// sombre, ou celui de l'appareil. Rendu dans l'en-tête des deux coquilles (cabinet
// et client) : un seul composant pour les deux.
//
// Un seul bouton qui fait le tour des trois états, pour ne pas élargir un en-tête
// déjà plein. Il affiche l'état EN COURS (« Thème clair ») ; le nom accessible
// commence par ce texte visible (WCAG 2.5.3) et dit ce que fait le clic. Sur petit
// écran le texte passe en lecture d'écran seulement, l'icône reste.
//
// `preference` reste `null` jusqu'au montage : le serveur ne connaît pas le choix
// stocké, donc rien de fiable à rendre avant l'hydratation.
export function ThemeToggle({ className }: { className?: string }) {
  const [preference, setPreference] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setPreference(readThemePreference());
  }, []);

  function cycle() {
    if (preference === null) return;
    const next = nextThemePreference(preference);
    setPreference(next);
    storeThemePreference(next);
    applyThemePreference(next);
  }

  const base = cn(
    "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-line bg-card px-3 text-base text-ink transition-colors hover:border-accent-text",
    className
  );

  if (preference === null) {
    // Même emplacement, même taille : pas de bandeau qui se redimensionne au montage.
    return <span className={cn(base, "invisible")} aria-hidden="true" />;
  }

  const Icon = ICONS[preference];
  const label = themePreferenceLabel(preference);
  return (
    // aria-label plutôt qu'un second texte masqué : le menu du compte (ClientShell)
    // rend visibles les `.sr-only` de ce bouton, et la consigne s'y afficherait.
    // Le nom commence par le texte visible (WCAG 2.5.3).
    <button type="button" onClick={cycle} className={base} aria-label={`${label} — changer de thème`}>
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}
