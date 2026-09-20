import { describe, expect, it } from "vitest";
import {
  buildAdditionalCriteriaCatalog,
  validateSuggestedCriteria,
  MAX_JUSTIFICATION_LENGTH,
  type CriterionCatalogSource,
} from "./criterion-suggestion-service";

const CATALOG: CriterionCatalogSource[] = [
  { id: "c-221", code: "2.2.1", label: "Liberté d'aller et venir", applicableTo: "BOTH" },
  { id: "c-227", code: "2.2.7", label: "Confidentialité et protection des données", applicableTo: "BOTH" },
  { id: "c-362", code: "3.6.2", label: "Circuit médicamenteux", applicableTo: "SAD_MIXTE" },
  { id: "c-999", code: "9.9.9", label: "Critère fictif SAD Aide", applicableTo: "SAD_AIDE" },
];

describe("buildAdditionalCriteriaCatalog", () => {
  it("exclut les critères déjà rattachés au type de document", () => {
    const catalog = buildAdditionalCriteriaCatalog(CATALOG, "SAD_AIDE", new Set(["c-221"]));
    expect(catalog.map((c) => c.code)).toEqual(["2.2.7", "9.9.9"]);
  });

  it("exclut un critère réservé à l'autre profil SAD", () => {
    const catalog = buildAdditionalCriteriaCatalog(CATALOG, "SAD_AIDE", new Set());
    expect(catalog.map((c) => c.code)).not.toContain("3.6.2");
  });

  it("inclut un critère réservé au SAD Mixte pour un établissement SAD Mixte", () => {
    const catalog = buildAdditionalCriteriaCatalog(CATALOG, "SAD_MIXTE", new Set());
    expect(catalog.map((c) => c.code)).toContain("3.6.2");
  });

  it("garde toujours les critères BOTH, quel que soit le profil", () => {
    const aide = buildAdditionalCriteriaCatalog(CATALOG, "SAD_AIDE", new Set());
    const mixte = buildAdditionalCriteriaCatalog(CATALOG, "SAD_MIXTE", new Set());
    expect(aide.map((c) => c.code)).toEqual(expect.arrayContaining(["2.2.1", "2.2.7"]));
    expect(mixte.map((c) => c.code)).toEqual(expect.arrayContaining(["2.2.1", "2.2.7"]));
  });
});

describe("validateSuggestedCriteria — jamais confiance dans la seule réponse du modèle", () => {
  it("rejette un code hors catalogue (hallucination)", () => {
    const result = validateSuggestedCriteria(
      [{ criterionCode: "5.5.5", justification: "Le document mentionne ceci." }],
      CATALOG
    );
    expect(result).toEqual([]);
  });

  it("accepte un code présent dans le catalogue avec sa justification", () => {
    const result = validateSuggestedCriteria(
      [{ criterionCode: "2.2.7", justification: "Le document décrit la charte de confidentialité." }],
      CATALOG
    );
    expect(result).toEqual([
      { criterionId: "c-227", justification: "Le document décrit la charte de confidentialité." },
    ]);
  });

  it("dédoublonne par code, garde la première occurrence", () => {
    const result = validateSuggestedCriteria(
      [
        { criterionCode: "2.2.1", justification: "Première mention." },
        { criterionCode: "2.2.1", justification: "Répétée par erreur." },
      ],
      CATALOG
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.justification).toBe("Première mention.");
  });

  it("rejette une justification vide après nettoyage", () => {
    const result = validateSuggestedCriteria([{ criterionCode: "2.2.1", justification: "   " }], CATALOG);
    expect(result).toEqual([]);
  });

  it("tronque une justification trop longue plutôt que de la rejeter", () => {
    const long = "x".repeat(MAX_JUSTIFICATION_LENGTH + 50);
    const result = validateSuggestedCriteria([{ criterionCode: "2.2.1", justification: long }], CATALOG);
    expect(result[0]?.justification).toHaveLength(MAX_JUSTIFICATION_LENGTH);
  });

  it("accepte plusieurs critères pour un même document — jusqu'à dix, pas un seul", () => {
    const raw = CATALOG.filter((c) => c.applicableTo !== "SAD_MIXTE").map((c) => ({
      criterionCode: c.code,
      justification: `Preuve pour ${c.code}.`,
    }));
    const result = validateSuggestedCriteria(raw, CATALOG);
    expect(result).toHaveLength(raw.length);
  });

  it("rend un tableau vide sans rien proposer plutôt que de forcer un critère", () => {
    expect(validateSuggestedCriteria([], CATALOG)).toEqual([]);
  });
});
