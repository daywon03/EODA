import { describe, expect, it } from "vitest";
import { pickInitialFormule } from "./devis-initial-formule-service";

// Retour du test de bout en bout (12/10/2026) : un nouveau devis proposait toujours
// la première formule du catalogue, même quand la fiche prospect disait déjà
// « Formule envisagée : Performance » — il fallait la resaisir, ou on l'oubliait.

const SELLABLE = [{ formule: "ESSENTIEL" as const }, { formule: "PERFORMANCE" as const }];

describe("pickInitialFormule", () => {
  it("présélectionne la formule envisagée du prospect sur un nouveau devis", () => {
    expect(pickInitialFormule({ formules: SELLABLE, envisagedFormule: "PERFORMANCE" })).toBe("PERFORMANCE");
  });

  it("retombe sur la première formule si l'envisagée n'est plus vendue", () => {
    expect(pickInitialFormule({ formules: SELLABLE, envisagedFormule: "EXCELLENCE" })).toBe("ESSENTIEL");
  });

  it("retombe sur la première formule sans formule envisagée", () => {
    expect(pickInitialFormule({ formules: SELLABLE, envisagedFormule: null })).toBe("ESSENTIEL");
  });

  it("garde la formule d'un brouillon, même si le prospect en envisageait une autre", () => {
    expect(
      pickInitialFormule({ formules: SELLABLE, envisagedFormule: "ESSENTIEL", draftFormule: "PERFORMANCE" })
    ).toBe("PERFORMANCE");
  });

  it("garde un brouillon « sans offre » sans offre", () => {
    expect(pickInitialFormule({ formules: SELLABLE, envisagedFormule: "PERFORMANCE", draftFormule: null })).toBe("");
  });

  it("remplace la formule d'un brouillon retirée du catalogue par la première vendue", () => {
    expect(pickInitialFormule({ formules: SELLABLE, draftFormule: "EXCELLENCE" })).toBe("ESSENTIEL");
  });

  it("rend une valeur vide quand le catalogue ne vend aucune formule", () => {
    expect(pickInitialFormule({ formules: [], envisagedFormule: "PERFORMANCE" })).toBe("");
  });
});
