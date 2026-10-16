import { describe, expect, it } from "vitest";
import { EMPTY_DEVIS_ERROR, devisContentError } from "./devis-calculation-service";
import { groupSignedDevisByFormule, type KpiDevis } from "./commercial-kpi-service";
import {
  correctionRight,
  coversMinFormule,
  getCoveredDocumentCategories,
  getEffectiveTier,
  isCriterionLevelCovered,
} from "./offer-scope-service";
import { defaultSupportModeForOffer, describeModeTag } from "./support-mode-service";
import { summariseConversionForAudit } from "./conversion-service";
import { APPOINTMENT_KIND_LABELS } from "./calendar-service";

// DEVIS SANS OFFRE (bilan §3.2, call du 01/09) : prestations à la carte seules. La
// formule devient facultative sur le devis ET sur la mission qui en naît. Ce qui est
// prouvé ici : jamais de devis vide ; une mission sans formule a le socle minimal,
// AUCUN droit de génération, et reste accompagnée.

describe("devisContentError", () => {
  it("accepte une offre seule, des options seules, ou les deux", () => {
    expect(devisContentError(true, 0)).toBeNull();
    expect(devisContentError(false, 1)).toBeNull();
    expect(devisContentError(true, 3)).toBeNull();
  });

  it("refuse un devis vide", () => {
    expect(devisContentError(false, 0)).toBe(EMPTY_DEVIS_ERROR);
  });
});

describe("mission sans formule", () => {
  it("a le palier SANS_OFFRE, sauf bêta-test gratuit", () => {
    expect(getEffectiveTier(null)).toBe("SANS_OFFRE");
    expect(getEffectiveTier(null, true)).toBe("EXCELLENCE");
  });

  it("n'a aucun droit de génération (fail-closed)", () => {
    expect(correctionRight({ formule: null, gratuit: false }, "LOI_2002_2")).toEqual({
      included: false,
      reason: "OUT_OF_OFFER",
    });
  });

  it("garde le socle minimal : loi 2002-2 et impératifs", () => {
    expect(getCoveredDocumentCategories(null)).toEqual(["LOI_2002_2"]);
    expect(isCriterionLevelCovered(null, false, "IMPERATIF")).toBe(true);
    expect(isCriterionLevelCovered(null, false, "STANDARD")).toBe(false);
  });

  it("ne couvre aucun item réservé à une offre", () => {
    expect(coversMinFormule(null, false, "ESSENTIEL")).toBe(false);
  });

  it("reste accompagnée, et se nomme « Prestations à la carte »", () => {
    expect(defaultSupportModeForOffer(null, false)).toBe("ACCOMPAGNE");
    expect(describeModeTag(null, "ACCOMPAGNE")).toBe("Prestations à la carte · accompagné par EODA");
    expect(describeModeTag(null, "AUTONOMIE")).toBe("Prestations à la carte · en autonomie");
  });

  it("se journalise sans formule inventée", () => {
    expect(summariseConversionForAudit({ devisNumber: "D-1", formule: null, optionCount: 2 })).toBe(
      "D-1 · SANS_OFFRE · 2 option(s)"
    );
  });
});

describe("KPI — un devis signé sans offre ne casse pas la répartition par formule", () => {
  it("l'ignore dans la répartition", () => {
    const list: KpiDevis[] = [
      { status: "SIGNE", totalAmountEuros: 500, catalogueFormule: null, prospect: { status: "SIGNE" } },
      { status: "SIGNE", totalAmountEuros: 2500, catalogueFormule: { formule: "ESSENTIEL" }, prospect: { status: "SIGNE" } },
    ];
    expect(groupSignedDevisByFormule(list)).toEqual({ BETA: 0, ESSENTIEL: 1, PERFORMANCE: 0, EXCELLENCE: 0 });
  });
});

describe("libellé du rendez-vous de cadrage (bilan §3.2)", () => {
  it("porte le mot cherché par Sandrine : « Réunion de lancement »", () => {
    expect(APPOINTMENT_KIND_LABELS.REUNION_CADRAGE).toContain("Réunion de lancement");
  });
});
