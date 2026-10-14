import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OptionPicker } from "./DevisFormSections";

// Recette du 13/10/2026 à 390 px : « 360 € / mois (engagement 12 mois minimum) »,
// écrit sur une seule ligne quoi qu'il arrive, élargissait la page « Nouveau devis »
// à 402 px. Le prix d'une option peut passer à la ligne sur téléphone ; il ne reste
// d'un seul tenant qu'à partir de la largeur tablette.
describe("OptionPicker", () => {
  it("le prix d'une option ne force pas une ligne unique sur téléphone", () => {
    const html = renderToStaticMarkup(
      h(OptionPicker, {
        options: [
          {
            id: "o-1",
            code: "AUTRE",
            label: "Option (fictive)",
            audienceLabel: null,
            priceEuros: 360,
            pricingUnit: "MOIS",
            priceMaxEuros: null,
            minQuantity: 12,
          },
        ],
        formule: "",
        selectedIds: [],
        onToggle: () => undefined,
        subscriptionNotice: null,
        disabled: false,
      })
    );
    expect(html).not.toMatch(/class="whitespace-nowrap[^"]*tabular-nums/);
    expect(html).toContain("sm:whitespace-nowrap");
  });
});
