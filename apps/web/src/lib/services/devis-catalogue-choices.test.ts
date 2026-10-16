import { describe, expect, it } from "vitest";
import { toDevisCatalogueChoices } from "./devis-catalogue-choices";

describe("ce que le formulaire de devis reçoit du catalogue", () => {
  const catalogue = {
    formules: [
      { id: "f1", formule: "ESSENTIEL" as const, label: "Essentiel", priceEuros: 2500, monthlyPriceEuros: null, modulesLabel: "16 impératifs", description: null, active: true },
      { id: "f2", formule: "PERFORMANCE" as const, label: "Performance", priceEuros: 6500, monthlyPriceEuros: 90, modulesLabel: null, description: null, active: false },
    ],
    options: [
      { id: "o1", code: "VISITE", label: "Visite", priceEuros: 900, pricingUnit: "JOUR" as const, priceMaxEuros: null, minQuantity: null, active: true },
      { id: "o2", code: "OLD", label: "Retirée", priceEuros: 10, pricingUnit: "FORFAIT" as const, priceMaxEuros: null, minQuantity: null, active: false, audienceLabel: "Toutes" },
    ],
  };

  it("ne propose que les lignes en vente", () => {
    const { formules, options } = toDevisCatalogueChoices(catalogue);
    expect(formules.map((f) => f.formule)).toEqual(["ESSENTIEL"]);
    expect(options.map((o) => o.id)).toEqual(["o1"]);
  });

  it("garde le prix mensuel non fixé à null (« xx € » à l'écran) et un « pour qui » absent à null", () => {
    const { formules, options } = toDevisCatalogueChoices(catalogue);
    expect(formules[0]!.monthlyPriceEuros).toBeNull();
    expect(options[0]!.audienceLabel).toBeNull();
  });
});
