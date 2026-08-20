import { describe, expect, it } from "vitest";
import {
  coversMinFormule,
  getCoveredDocumentCategories,
  getEffectiveTier,
  getOfferScope,
  isDocumentCategoryCovered,
} from "./offer-scope-service";

// Règles de référence : .claude/context/07-outil-pilotage-missions.md §7.3, §12.1,
// §12.4 et .claude/context/08-offre-commerciale-v10.md §04.

describe("getEffectiveTier — §7.5", () => {
  it("mappe BETA et le bêta-test gratuit sur le périmètre Excellence", () => {
    expect(getEffectiveTier("BETA")).toBe("EXCELLENCE");
    expect(getEffectiveTier("ESSENTIEL", true)).toBe("EXCELLENCE");
    expect(getEffectiveTier("PERFORMANCE", true)).toBe("EXCELLENCE");
  });

  it("laisse les offres payantes inchangées", () => {
    expect(getEffectiveTier("ESSENTIEL", false)).toBe("ESSENTIEL");
    expect(getEffectiveTier("PERFORMANCE", false)).toBe("PERFORMANCE");
    expect(getEffectiveTier("EXCELLENCE", false)).toBe("EXCELLENCE");
  });
});

describe("getOfferScope — périmètre des offres", () => {
  it("limite l'Essentiel aux critères impératifs et à la loi 2002-2, sans correction", () => {
    expect(getOfferScope("ESSENTIEL")).toEqual({
      criteriaScope: "IMPERATIFS_ONLY",
      correctionScope: "NONE",
      documentCategories: ["LOI_2002_2"],
    });
  });

  it("ouvre Performance à tous les critères, avec correction limitée à la loi 2002-2", () => {
    expect(getOfferScope("PERFORMANCE")).toMatchObject({
      criteriaScope: "ALL",
      correctionScope: "LOI_2002_2_ONLY",
    });
  });

  it("ouvre tout en Excellence", () => {
    expect(getOfferScope("EXCELLENCE")).toMatchObject({
      criteriaScope: "ALL",
      correctionScope: "ALL",
    });
  });

  it("accorde le périmètre Excellence au bêta-test (BETA comme gratuit)", () => {
    expect(getOfferScope("BETA")).toEqual(getOfferScope("EXCELLENCE"));
    expect(getOfferScope("ESSENTIEL", true)).toEqual(getOfferScope("EXCELLENCE"));
  });
});

describe("coversMinFormule — ordre de couverture des offres", () => {
  it("couvre toujours une exigence ESSENTIEL", () => {
    for (const formule of ["ESSENTIEL", "PERFORMANCE", "EXCELLENCE", "BETA"] as const) {
      expect(coversMinFormule(formule, false, "ESSENTIEL")).toBe(true);
    }
  });

  it("refuse à Essentiel un élément exigeant Performance ou Excellence", () => {
    expect(coversMinFormule("ESSENTIEL", false, "PERFORMANCE")).toBe(false);
    expect(coversMinFormule("ESSENTIEL", false, "EXCELLENCE")).toBe(false);
  });

  it("refuse à Performance un élément réservé Excellence", () => {
    expect(coversMinFormule("PERFORMANCE", false, "EXCELLENCE")).toBe(false);
  });

  it("accorde tout à Excellence et au bêta-test gratuit", () => {
    expect(coversMinFormule("EXCELLENCE", false, "EXCELLENCE")).toBe(true);
    expect(coversMinFormule("ESSENTIEL", true, "EXCELLENCE")).toBe(true);
    expect(coversMinFormule("BETA", false, "EXCELLENCE")).toBe(true);
  });

  it("traite une exigence BETA comme une exigence Excellence", () => {
    expect(coversMinFormule("PERFORMANCE", false, "BETA")).toBe(false);
    expect(coversMinFormule("EXCELLENCE", false, "BETA")).toBe(true);
  });
});

describe("catégories documentaires couvertes — §12.1", () => {
  it("réduit l'Essentiel à la seule catégorie loi 2002-2", () => {
    expect(getCoveredDocumentCategories("ESSENTIEL", false)).toEqual(["LOI_2002_2"]);
    expect(isDocumentCategoryCovered("ESSENTIEL", false, "LOI_2002_2")).toBe(true);
    for (const cat of ["FONCTIONNEMENT", "QUALITE_RISQUES", "RH"] as const) {
      expect(isDocumentCategoryCovered("ESSENTIEL", false, cat)).toBe(false);
    }
  });

  it("ouvre les quatre catégories dès Performance", () => {
    for (const formule of ["PERFORMANCE", "EXCELLENCE", "BETA"] as const) {
      expect(getCoveredDocumentCategories(formule, false)).toHaveLength(4);
      expect(isDocumentCategoryCovered(formule, false, "RH")).toBe(true);
    }
  });

  it("ouvre les quatre catégories à un Essentiel en bêta-test gratuit", () => {
    expect(getCoveredDocumentCategories("ESSENTIEL", true)).toHaveLength(4);
  });
});
