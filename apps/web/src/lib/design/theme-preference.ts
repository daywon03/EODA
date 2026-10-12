// Préférence de thème — règles pures (le DOM et le stockage vivent dans
// components/theme/theme-storage.ts).
//
// Trois états : clair, sombre, ou « celui de l'appareil ». Le troisième n'est pas
// un confort : sans lui, un premier clic sur la bascule fixait un choix pour
// toujours, et l'écran ne suivait plus jamais le réglage du système.

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

// Valeur stockée = entrée non fiable (autre onglet, ancienne version, extension).
export function parseThemePreference(raw: string | null): ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(raw ?? "") ? (raw as ThemePreference) : "system";
}

export function nextThemePreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current);
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? "system";
}

const LABELS: Record<ThemePreference, string> = {
  system: "Thème de l'appareil",
  light: "Thème clair",
  dark: "Thème sombre",
};

export function themePreferenceLabel(preference: ThemePreference): string {
  return LABELS[preference];
}
