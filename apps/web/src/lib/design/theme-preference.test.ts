import { describe, expect, it } from "vitest";
import {
  THEME_PREFERENCES,
  nextThemePreference,
  parseThemePreference,
  themePreferenceLabel,
} from "./theme-preference";

// Trois états, pas deux (retour du test de bout en bout, 12/10/2026) : une fois
// « clair » ou « sombre » choisi, rien ne permettait de revenir à « suivre le
// système » — le choix stocké l'emportait pour toujours.
describe("préférence de thème", () => {
  it("lit le stockage et retombe sur « système » pour tout le reste", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("toString")).toBe("system");
  });

  it("fait le tour des trois états, sans en sauter aucun", () => {
    const seen = new Set<string>();
    let current = THEME_PREFERENCES[0];
    for (let step = 0; step < THEME_PREFERENCES.length; step += 1) {
      seen.add(current);
      current = nextThemePreference(current);
    }
    expect([...seen].sort()).toEqual([...THEME_PREFERENCES].sort());
    expect(current).toBe(THEME_PREFERENCES[0]);
  });

  it("nomme l'état en cours en mots simples", () => {
    expect(themePreferenceLabel("light")).toBe("Thème clair");
    expect(themePreferenceLabel("dark")).toBe("Thème sombre");
    expect(themePreferenceLabel("system")).toBe("Thème de l'appareil");
  });
});
