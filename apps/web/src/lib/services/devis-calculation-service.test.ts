import { describe, expect, it } from "vitest";
import {
  computeDevisAmounts,
  computeValidUntil,
  nextProspectStatusForDevisTransition,
  optionCommittedAmountEuros,
} from "./devis-calculation-service";
import {
  computeConversionRatePercent,
  computeIssuedDevisCount,
  computeSignedRevenueEuros,
  computeWeightedPipelineEuros,
  groupSignedDevisByFormule,
  type KpiDevis,
} from "./commercial-kpi-service";

// Règles de référence : .claude/context/07-outil-pilotage-missions.md §6.1-§6.3 et §8.
// Ce sont des calculs facturés au client et des indicateurs de pilotage : le coût d'un
// défaut y est direct, d'où la priorité de couverture.

// Offre v10 §04 : une option n'est plus forcément un forfait. Le devis retient
// l'engagement minimal, jamais la borne haute d'une fourchette (prix « à partir de »).
describe("optionCommittedAmountEuros — options tarifées à l'unité (offre v10 §04)", () => {
  it("retient le prix tel quel pour un forfait sans minimum", () => {
    expect(optionCommittedAmountEuros({ priceEuros: 800 })).toBe(800);
    expect(optionCommittedAmountEuros({ priceEuros: 1200, minQuantity: null })).toBe(1200);
  });

  it("multiplie par la quantité minimale : mise à jour documentaire 95 €/h, mini. 2 h", () => {
    expect(optionCommittedAmountEuros({ priceEuros: 95, minQuantity: 2 })).toBe(190);
  });

  it("engage 12 mois sur l'abonnement portail + veille à 400 €/mois", () => {
    expect(optionCommittedAmountEuros({ priceEuros: 400, minQuantity: 12 })).toBe(4800);
  });

  it("traite une quantité minimale de 1 ou 0 comme une unité", () => {
    expect(optionCommittedAmountEuros({ priceEuros: 250, minQuantity: 1 })).toBe(250);
    expect(optionCommittedAmountEuros({ priceEuros: 250, minQuantity: 0 })).toBe(250);
  });

  it("porte le minimum d'engagement dans le total du devis", () => {
    const amounts = computeDevisAmounts({
      formulePriceEuros: 15000,
      optionPricesEuros: [
        optionCommittedAmountEuros({ priceEuros: 95, minQuantity: 2 }),
        optionCommittedAmountEuros({ priceEuros: 400, minQuantity: 12 }),
      ],
      depositPercent: 40,
      installmentCount: 1,
    });
    expect(amounts.totalAmountEuros).toBe(19990);
    expect(amounts.depositAmountEuros).toBe(7996);
    expect(amounts.balanceAmountEuros).toBe(11994);
  });
});

describe("computeDevisAmounts — §6.1", () => {
  it("additionne le prix de la formule et les options", () => {
    const amounts = computeDevisAmounts({
      formulePriceEuros: 6500,
      optionPricesEuros: [800, 450],
      depositPercent: 30,
      installmentCount: 3,
    });
    expect(amounts.totalAmountEuros).toBe(7750);
  });

  it("calcule l'acompte, le solde et l'échéance", () => {
    const amounts = computeDevisAmounts({
      formulePriceEuros: 5000,
      optionPricesEuros: [],
      depositPercent: 30,
      installmentCount: 2,
    });
    expect(amounts).toEqual({
      totalAmountEuros: 5000,
      depositAmountEuros: 1500,
      balanceAmountEuros: 3500,
      installmentAmountEuros: 1750,
    });
  });

  it("garde acompte + solde = total malgré l'arrondi de l'acompte", () => {
    const amounts = computeDevisAmounts({
      formulePriceEuros: 1001,
      optionPricesEuros: [],
      depositPercent: 33,
      installmentCount: 1,
    });
    // Le solde est dérivé du total moins l'acompte, jamais recalculé par pourcentage —
    // sinon un centime se perd et le devis ne s'équilibre plus.
    expect(amounts.depositAmountEuros + amounts.balanceAmountEuros).toBe(
      amounts.totalAmountEuros
    );
  });

  it("gère un acompte de 0 % et de 100 %", () => {
    const zero = computeDevisAmounts({
      formulePriceEuros: 1000,
      optionPricesEuros: [],
      depositPercent: 0,
      installmentCount: 1,
    });
    expect(zero).toMatchObject({ depositAmountEuros: 0, balanceAmountEuros: 1000 });

    const full = computeDevisAmounts({
      formulePriceEuros: 1000,
      optionPricesEuros: [],
      depositPercent: 100,
      installmentCount: 1,
    });
    expect(full).toMatchObject({ depositAmountEuros: 1000, balanceAmountEuros: 0 });
  });
});

describe("computeValidUntil — §6.1", () => {
  it("ajoute la durée de validité à la date de création", () => {
    const validUntil = computeValidUntil(new Date("2026-09-01T10:00:00Z"), 30);
    expect(validUntil.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("ne modifie pas la date passée en argument", () => {
    const createdAt = new Date("2026-09-01T10:00:00Z");
    computeValidUntil(createdAt, 30);
    expect(createdAt.toISOString()).toBe("2026-09-01T10:00:00.000Z");
  });
});

describe("nextProspectStatusForDevisTransition — §6.3", () => {
  it("fait passer le prospect à SIGNE quel que soit son statut précédent", () => {
    expect(nextProspectStatusForDevisTransition("SIGNE", "NOUVEAU")).toBe("SIGNE");
    expect(nextProspectStatusForDevisTransition("SIGNE", "PERDU")).toBe("SIGNE");
  });

  it("passe à DEVIS_ENVOYE uniquement depuis NOUVEAU ou RDV", () => {
    expect(nextProspectStatusForDevisTransition("ENVOYE", "NOUVEAU")).toBe("DEVIS_ENVOYE");
    expect(nextProspectStatusForDevisTransition("ENVOYE", "RDV")).toBe("DEVIS_ENVOYE");
  });

  it("ne rétrograde jamais un prospect en NEGOCIATION ou SIGNE", () => {
    expect(nextProspectStatusForDevisTransition("ENVOYE", "NEGOCIATION")).toBeNull();
    expect(nextProspectStatusForDevisTransition("ENVOYE", "SIGNE")).toBeNull();
  });

  it("n'a aucun effet de bord pour BROUILLON et REFUSE", () => {
    expect(nextProspectStatusForDevisTransition("BROUILLON", "NOUVEAU")).toBeNull();
    expect(nextProspectStatusForDevisTransition("REFUSE", "NEGOCIATION")).toBeNull();
  });
});

function devis(
  status: KpiDevis["status"],
  totalAmountEuros: number,
  formule: KpiDevis["catalogueFormule"]["formule"],
  prospectStatus: KpiDevis["prospect"]["status"]
): KpiDevis {
  return { status, totalAmountEuros, catalogueFormule: { formule }, prospect: { status: prospectStatus } };
}

describe("KPI commerciaux — §8", () => {
  const list: KpiDevis[] = [
    devis("SIGNE", 15000, "EXCELLENCE", "SIGNE"),
    devis("ENVOYE", 6500, "PERFORMANCE", "DEVIS_ENVOYE"),
    devis("BROUILLON", 5000, "ESSENTIEL", "NEGOCIATION"),
    devis("REFUSE", 5000, "ESSENTIEL", "PERDU"),
  ];

  it("calcule le taux de conversion sur le total des devis émis", () => {
    expect(computeConversionRatePercent(list)).toBe(25);
  });

  it("renvoie 0 % sans devis, au lieu de diviser par zéro", () => {
    expect(computeConversionRatePercent([])).toBe(0);
  });

  it("pondère le pipeline : ENVOYE à 30 %, prospect en NEGOCIATION à 60 %", () => {
    // 6500 × 0,30 = 1950 ; 5000 × 0,60 = 3000 → 4950.
    expect(computeWeightedPipelineEuros(list)).toBe(4950);
  });

  it("ne compte dans le CA signé que les devis au statut SIGNE", () => {
    expect(computeSignedRevenueEuros(list)).toBe(15000);
  });

  it("répartit les devis signés par formule", () => {
    expect(groupSignedDevisByFormule(list)).toEqual({
      BETA: 0,
      ESSENTIEL: 0,
      PERFORMANCE: 0,
      EXCELLENCE: 1,
    });
  });

  it("compte les devis émis sans les annulés", () => {
    expect(computeIssuedDevisCount(list)).toBe(4);
    expect(computeIssuedDevisCount([...list, devis("ANNULE", 9000, "EXCELLENCE", "SIGNE")])).toBe(4);
  });
});

// Régression : un devis annulé conserve sa ligne et son numéro en base, mais ne
// doit alimenter AUCUN indicateur. Sans ce filtre, une annulation de devis signé
// laissait son montant dans le « CA signé » — une erreur invisible à l'œil.
describe("KPI commerciaux — exclusion des devis annulés", () => {
  const withCancelled: KpiDevis[] = [
    devis("SIGNE", 15000, "EXCELLENCE", "SIGNE"),
    devis("ANNULE", 15000, "EXCELLENCE", "SIGNE"),
    devis("ANNULE", 6500, "PERFORMANCE", "NEGOCIATION"),
  ];

  it("ne compte pas un devis annulé dans le CA signé", () => {
    expect(computeSignedRevenueEuros(withCancelled)).toBe(15000);
  });

  it("ne compte pas un devis annulé dans le pipeline pondéré, même via le statut du prospect", () => {
    // Le second terme du pipeline filtre sur le prospect en NEGOCIATION : sans
    // exclusion du devis annulé, 6500 × 0,60 = 3900 seraient comptés.
    expect(computeWeightedPipelineEuros(withCancelled)).toBe(0);
  });

  it("exclut les devis annulés du dénominateur du taux de conversion", () => {
    // 1 signé sur 1 devis actif = 100 %, et non 1 sur 3.
    expect(computeConversionRatePercent(withCancelled)).toBe(100);
  });

  it("renvoie 0 % quand tous les devis sont annulés, sans diviser par zéro", () => {
    expect(computeConversionRatePercent([devis("ANNULE", 15000, "EXCELLENCE", "SIGNE")])).toBe(0);
  });

  it("ne compte pas un devis annulé dans la répartition par formule", () => {
    expect(groupSignedDevisByFormule(withCancelled)).toEqual({
      BETA: 0,
      ESSENTIEL: 0,
      PERFORMANCE: 0,
      EXCELLENCE: 1,
    });
  });
});
