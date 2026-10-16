import { parseThemePreference, type ThemePreference } from "@/lib/design/theme-preference";

export const STORAGE_KEY = "eoda-theme";

// Un choix explicite l'emporte sur la préférence système ; « système » (ou rien de
// stocké) laisse globals.css suivre `@media (prefers-color-scheme)` — y compris
// quand l'appareil change de réglage pendant la visite, sans aucun écouteur.
export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    // Stockage refusé (navigation privée, données de site bloquées) : on suit le système.
    return "system";
  }
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Stockage refusé : le thème change pour cette page seulement.
  }
}

// `data-theme` sur <html>, jamais une classe : globals.css cible déjà
// `:root[data-theme]`. « Système » RETIRE l'attribut : c'est alors la requête média
// de globals.css qui décide, sans dupliquer les variables de couleur.
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
}
