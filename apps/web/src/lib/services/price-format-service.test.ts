import { describe, expect, it } from "vitest";
import {
  STARTING_PRICE_PREFIX,
  formatEuros,
  formatPriceWithUnit,
  formatStartingPrice,
} from "./price-format-service";

// Règles de référence : .claude/context/08-offre-commerciale-v10.md §04 (unités, fourchettes,
// minimums) et .claude/context/07-outil-pilotage-missions.md §12.3 (prix toujours
// « à partir de »). Ce module rend des montants imprimés sur un devis client :
// une erreur de typographie ou d'unité part chez le prospect.

// Espaces typographiques attendues : fine insécable entre milliers, insécable avant €.
const NARROW = "\u202F";
const NBSP = "\u00A0";

describe("formatEuros", () => {
  it("groupe les milliers avec une espace fine insécable", () => {
    expect(formatEuros(15000)).toBe(`15${NARROW}000${NBSP}€`);
  });

  it("n'ajoute pas de séparateur en dessous de mille", () => {
    expect(formatEuros(800)).toBe(`800${NBSP}€`);
  });

  it("groupe les millions", () => {
    expect(formatEuros(1234567)).toBe(`1${NARROW}234${NARROW}567${NBSP}€`);
  });

  it("arrondit à l'euro et gère zéro", () => {
    expect(formatEuros(0)).toBe(`0${NBSP}€`);
    expect(formatEuros(1249.6)).toBe(`1${NARROW}250${NBSP}€`);
  });

  it("préfixe un montant négatif", () => {
    expect(formatEuros(-1200)).toBe(`-1${NARROW}200${NBSP}€`);
  });
});

describe("formatPriceWithUnit — une unité par ligne du §04", () => {
  it("n'ajoute aucun suffixe à un forfait", () => {
    expect(formatPriceWithUnit({ priceEuros: 800, pricingUnit: "FORFAIT" })).toBe(`800${NBSP}€`);
  });

  it("traite une unité absente comme un forfait", () => {
    expect(formatPriceWithUnit({ priceEuros: 1500 })).toBe(`1${NARROW}500${NBSP}€`);
  });

  it("suffixe l'unité horaire", () => {
    expect(formatPriceWithUnit({ priceEuros: 95, pricingUnit: "HEURE" })).toBe(`95${NBSP}€ / h`);
  });

  it("suffixe l'unité journalière", () => {
    expect(formatPriceWithUnit({ priceEuros: 750, pricingUnit: "JOUR" })).toBe(`750${NBSP}€ / jour`);
  });

  it("suffixe l'unité documentaire (procédure clé en main)", () => {
    expect(formatPriceWithUnit({ priceEuros: 250, pricingUnit: "DOCUMENT" })).toBe(
      `250${NBSP}€ / document`
    );
  });

  it("suffixe l'unité support (outils de sensibilisation)", () => {
    expect(formatPriceWithUnit({ priceEuros: 300, pricingUnit: "SUPPORT" })).toBe(
      `300${NBSP}€ / support`
    );
  });

  it("suffixe l'unité mensuelle (abonnement portail + veille)", () => {
    expect(formatPriceWithUnit({ priceEuros: 400, pricingUnit: "MOIS" })).toBe(
      `400${NBSP}€ / mois`
    );
  });
});

describe("formatPriceWithUnit — fourchettes", () => {
  it("rend « 95 à 120 € / h » et ne répète pas le symbole euro", () => {
    expect(
      formatPriceWithUnit({ priceEuros: 95, priceMaxEuros: 120, pricingUnit: "HEURE" })
    ).toBe(`95 à 120${NBSP}€ / h`);
  });

  it("groupe les milliers des deux bornes", () => {
    expect(formatPriceWithUnit({ priceEuros: 1200, priceMaxEuros: 3500 })).toBe(
      `1${NARROW}200 à 3${NARROW}500${NBSP}€`
    );
  });

  it("ignore une borne haute nulle, absente ou inférieure au prix de départ", () => {
    expect(formatPriceWithUnit({ priceEuros: 250, priceMaxEuros: null })).toBe(`250${NBSP}€`);
    expect(formatPriceWithUnit({ priceEuros: 250, priceMaxEuros: 200 })).toBe(`250${NBSP}€`);
    expect(formatPriceWithUnit({ priceEuros: 250, priceMaxEuros: 250 })).toBe(`250${NBSP}€`);
  });
});

describe("formatPriceWithUnit — quantité minimale", () => {
  it("mentionne « mini. 2 h » (mise à jour documentaire à la carte)", () => {
    expect(
      formatPriceWithUnit({
        priceEuros: 95,
        priceMaxEuros: 120,
        pricingUnit: "HEURE",
        minQuantity: 2,
      })
    ).toBe(`95 à 120${NBSP}€ / h (mini. 2 h)`);
  });

  it("exprime un abonnement mensuel en engagement (400 € / mois, 1 an)", () => {
    expect(
      formatPriceWithUnit({ priceEuros: 400, pricingUnit: "MOIS", minQuantity: 12 })
    ).toBe(`400${NBSP}€ / mois (engagement 12 mois minimum)`);
  });

  it("accorde le libellé de quantité au pluriel et au singulier", () => {
    expect(formatPriceWithUnit({ priceEuros: 250, pricingUnit: "DOCUMENT", minQuantity: 3 })).toBe(
      `250${NBSP}€ / document (mini. 3 documents)`
    );
    expect(formatPriceWithUnit({ priceEuros: 300, pricingUnit: "SUPPORT", minQuantity: 2 })).toBe(
      `300${NBSP}€ / support (mini. 2 supports)`
    );
    expect(formatPriceWithUnit({ priceEuros: 750, pricingUnit: "JOUR", minQuantity: 2 })).toBe(
      `750${NBSP}€ / jour (mini. 2 jours)`
    );
    expect(formatPriceWithUnit({ priceEuros: 750, pricingUnit: "JOUR", minQuantity: 1 })).toBe(
      `750${NBSP}€ / jour`
    );
  });

  it("ignore une quantité minimale absente, nulle ou posée sur un forfait", () => {
    expect(formatPriceWithUnit({ priceEuros: 95, pricingUnit: "HEURE", minQuantity: null })).toBe(
      `95${NBSP}€ / h`
    );
    expect(formatPriceWithUnit({ priceEuros: 800, pricingUnit: "FORFAIT", minQuantity: 4 })).toBe(
      `800${NBSP}€`
    );
  });
});

describe("formatStartingPrice — §12.3, jamais un prix fixe", () => {
  it("préfixe systématiquement le prix d'une formule", () => {
    expect(formatStartingPrice({ priceEuros: 15000 })).toBe(
      `${STARTING_PRICE_PREFIX} 15${NARROW}000${NBSP}€`
    );
  });

  it("conserve unité, fourchette et minimum derrière le préfixe", () => {
    expect(
      formatStartingPrice({
        priceEuros: 95,
        priceMaxEuros: 120,
        pricingUnit: "HEURE",
        minQuantity: 2,
      })
    ).toBe(`${STARTING_PRICE_PREFIX} 95 à 120${NBSP}€ / h (mini. 2 h)`);
  });
});
