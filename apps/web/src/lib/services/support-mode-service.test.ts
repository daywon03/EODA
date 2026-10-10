import { describe, expect, it } from "vitest";
import {
  STRICT_SUPPORT_MODE,
  defaultSupportModeForOffer,
  describeModeTag,
  parseSupportMode,
  resolveSupportMode,
  toUiSupportMode,
} from "./support-mode-service";

describe("defaultSupportModeForOffer — décision 2 des maquettes v2", () => {
  it("Excellence est accompagnée", () => {
    expect(defaultSupportModeForOffer("EXCELLENCE", false)).toBe("ACCOMPAGNE");
  });

  it("Essentiel et Performance sont en autonomie à la signature", () => {
    expect(defaultSupportModeForOffer("ESSENTIEL", false)).toBe("AUTONOMIE");
    expect(defaultSupportModeForOffer("PERFORMANCE", false)).toBe("AUTONOMIE");
  });

  it("le bêta-test gratuit suit Excellence", () => {
    expect(defaultSupportModeForOffer("BETA", false)).toBe("ACCOMPAGNE");
    expect(defaultSupportModeForOffer("ESSENTIEL", true)).toBe("ACCOMPAGNE");
  });
});

describe("resolveSupportMode", () => {
  it("sans mission, la règle STRICTE (rien de non relu au client)", () => {
    expect(resolveSupportMode(null)).toBe("ACCOMPAGNE");
    expect(STRICT_SUPPORT_MODE).toBe("ACCOMPAGNE");
  });

  it("avec mission, le mode stocké", () => {
    expect(resolveSupportMode({ supportMode: "AUTONOMIE" })).toBe("AUTONOMIE");
  });
});

describe("parseSupportMode — entrée non fiable", () => {
  it("accepte les deux valeurs exactes", () => {
    expect(parseSupportMode("AUTONOMIE")).toBe("AUTONOMIE");
    expect(parseSupportMode("ACCOMPAGNE")).toBe("ACCOMPAGNE");
  });

  it("refuse tout le reste, sans défaut", () => {
    for (const raw of ["autonomie", "", null, undefined, 1, "toString"]) {
      expect(parseSupportMode(raw)).toBeNull();
    }
  });
});

describe("describeModeTag / toUiSupportMode", () => {
  it("nomme l'offre et le mode, jamais un prénom (D7)", () => {
    expect(describeModeTag("EXCELLENCE", "ACCOMPAGNE")).toBe("Excellence · accompagné par EODA");
    expect(describeModeTag("ESSENTIEL", "AUTONOMIE")).toBe("Offre Essentiel · en autonomie");
    expect(describeModeTag("BETA", "ACCOMPAGNE")).not.toMatch(/Sandrine/);
  });

  it("traduit vers le vocabulaire du composant ModeTag", () => {
    expect(toUiSupportMode("ACCOMPAGNE")).toBe("accompagne");
    expect(toUiSupportMode("AUTONOMIE")).toBe("autonomie");
  });
});
