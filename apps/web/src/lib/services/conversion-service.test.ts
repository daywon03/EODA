import { describe, expect, it } from "vitest";
import {
  CONVERSION_REFUSAL_MESSAGES,
  impliesSeventeenthImperatif,
  isConversionTransition,
  isDevisSignable,
  planConversion,
  summariseConversionForAudit,
  toMissionOptionSnapshots,
  type ConversionInput,
  type OptionSnapshot,
} from "@/lib/services/conversion-service";

// Cas nominal : devis envoyé, prospect jamais converti, type de SAD saisi.
function baseInput(overrides: Partial<ConversionInput> = {}): ConversionInput {
  return {
    devisStatus: "ENVOYE",
    devisTenantId: "tenant-eoda",
    prospectTenantId: "tenant-eoda",
    existingEstablishmentId: null,
    existingMissionId: null,
    establishmentType: "SAD_AIDE",
    ...overrides,
  };
}

describe("isDevisSignable", () => {
  it("n'autorise la signature que depuis ENVOYE", () => {
    expect(isDevisSignable("ENVOYE")).toBe(true);
    expect(isDevisSignable("BROUILLON")).toBe(false);
    expect(isDevisSignable("SIGNE")).toBe(false);
    expect(isDevisSignable("REFUSE")).toBe(false);
    expect(isDevisSignable("ANNULE")).toBe(false);
  });
});

describe("isConversionTransition", () => {
  it("ne reconnaît que SIGNE comme transition de conversion", () => {
    expect(isConversionTransition("SIGNE")).toBe(true);
    expect(isConversionTransition("ENVOYE")).toBe(false);
    expect(isConversionTransition("ANNULE")).toBe(false);
  });
});

describe("planConversion — cas nominal", () => {
  it("crée la fiche et la mission pour un prospect jamais converti", () => {
    expect(planConversion(baseInput())).toEqual({
      kind: "PROCEED",
      createsEstablishment: true,
      createsMission: true,
    });
  });

  it("réutilise la fiche existante et se contente de créer la mission manquante", () => {
    const plan = planConversion(
      baseInput({ existingEstablishmentId: "etab-1", existingMissionId: null })
    );
    expect(plan).toEqual({
      kind: "PROCEED",
      createsEstablishment: false,
      createsMission: true,
    });
  });

  it("n'exige pas le type de SAD quand la fiche existe déjà — il y est déjà saisi", () => {
    const plan = planConversion(
      baseInput({
        existingEstablishmentId: "etab-1",
        existingMissionId: null,
        establishmentType: null,
      })
    );
    expect(plan.kind).toBe("PROCEED");
  });
});

// Les quatre refus. Ce sont eux qui protègent la charnière du parcours : chacun
// correspond à une manière réelle de produire un client incohérent.
describe("planConversion — refus", () => {
  it("refuse un devis dont le prospect appartient à un autre cabinet", () => {
    expect(planConversion(baseInput({ prospectTenantId: "tenant-autre" }))).toEqual({
      kind: "REFUSED",
      reason: "TENANT_MISMATCH",
    });
  });

  it("refuse le cloisonnement AVANT toute autre considération", () => {
    // Un devis d'un autre tenant ne doit pas produire un message qui révèle son
    // statut ou l'état de sa conversion : le refus de cloisonnement passe en premier.
    const plan = planConversion(
      baseInput({
        prospectTenantId: "tenant-autre",
        devisStatus: "SIGNE",
        existingEstablishmentId: "etab-1",
        existingMissionId: "mission-1",
      })
    );
    expect(plan).toEqual({ kind: "REFUSED", reason: "TENANT_MISMATCH" });
  });

  it("refuse la double signature", () => {
    expect(planConversion(baseInput({ devisStatus: "SIGNE" }))).toEqual({
      kind: "REFUSED",
      reason: "STATUS_NOT_SIGNABLE",
    });
  });

  it("refuse un devis non émis, refusé ou annulé", () => {
    for (const status of ["BROUILLON", "REFUSE", "ANNULE"] as const) {
      expect(planConversion(baseInput({ devisStatus: status }))).toEqual({
        kind: "REFUSED",
        reason: "STATUS_NOT_SIGNABLE",
      });
    }
  });

  it("refuse un prospect déjà converti — fiche ET mission existantes", () => {
    expect(
      planConversion(
        baseInput({ existingEstablishmentId: "etab-1", existingMissionId: "mission-1" })
      )
    ).toEqual({ kind: "REFUSED", reason: "ALREADY_CONVERTED" });
  });

  it("refuse la création d'une fiche sans type d'établissement", () => {
    expect(planConversion(baseInput({ establishmentType: null }))).toEqual({
      kind: "REFUSED",
      reason: "MISSING_ESTABLISHMENT_TYPE",
    });
  });

  it("porte un message distinct pour chaque motif", () => {
    const messages = Object.values(CONVERSION_REFUSAL_MESSAGES);
    expect(new Set(messages).size).toBe(messages.length);
    expect(messages.every((message) => message.length > 0)).toBe(true);
  });
});

describe("impliesSeventeenthImperatif", () => {
  it("signale le 17ᵉ impératif pour un SAD mixte uniquement", () => {
    expect(impliesSeventeenthImperatif("SAD_MIXTE")).toBe(true);
    expect(impliesSeventeenthImperatif("SAD_AIDE")).toBe(false);
  });
});

describe("toMissionOptionSnapshots", () => {
  const devisOption: OptionSnapshot = {
    catalogueOptionId: "opt-kpi",
    labelSnapshot: "Tableau de bord 24 KPI",
    priceSnapshotEuros: 1200,
    pricingUnitSnapshot: "FORFAIT",
    priceMaxSnapshotEuros: null,
    minQuantitySnapshot: null,
  };

  it("recopie le snapshot du devis sans le réécrire", () => {
    expect(toMissionOptionSnapshots([devisOption])).toEqual([devisOption]);
  });

  it("conserve l'unité, la borne haute et le minimum facturable", () => {
    const horaire: OptionSnapshot = {
      catalogueOptionId: "opt-doc",
      labelSnapshot: "Mise à jour documentaire",
      priceSnapshotEuros: 95,
      pricingUnitSnapshot: "HEURE",
      priceMaxSnapshotEuros: 120,
      minQuantitySnapshot: 2,
    };
    const [snapshot] = toMissionOptionSnapshots([horaire]);
    expect(snapshot).toEqual(horaire);
  });

  it("rend un tableau vide pour un devis sans option", () => {
    expect(toMissionOptionSnapshots([])).toEqual([]);
  });
});

describe("summariseConversionForAudit", () => {
  it("ne produit que des clés techniques, aucune donnée nominative", () => {
    const detail = summariseConversionForAudit({
      devisNumber: "DEVIS-2026-004",
      formule: "EXCELLENCE",
      optionCount: 2,
    });
    expect(detail).toBe("DEVIS-2026-004 · EXCELLENCE · 2 option(s)");
  });
});
