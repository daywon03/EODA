import { describe, expect, it } from "vitest";
import { isCriterionImperativeForEstablishment } from "./criterion-imperativeness-service";

describe("isCriterionImperativeForEstablishment", () => {
  it("un critère IMPERATIF en base reste impératif pour les deux profils", () => {
    const criterion = { code: "3.11.1", requirementLevel: "IMPERATIF" as const };
    expect(isCriterionImperativeForEstablishment(criterion, "SAD_AIDE")).toBe(true);
    expect(isCriterionImperativeForEstablishment(criterion, "SAD_MIXTE")).toBe(true);
  });

  it("un critère STANDARD quelconque reste standard pour les deux profils", () => {
    const criterion = { code: "1.1.1", requirementLevel: "STANDARD" as const };
    expect(isCriterionImperativeForEstablishment(criterion, "SAD_AIDE")).toBe(false);
    expect(isCriterionImperativeForEstablishment(criterion, "SAD_MIXTE")).toBe(false);
  });

  it("3.6.2 (circuit médicament) est impératif seulement pour un SAD Mixte", () => {
    const criterion = { code: "3.6.2", requirementLevel: "STANDARD" as const };
    expect(isCriterionImperativeForEstablishment(criterion, "SAD_AIDE")).toBe(false);
    expect(isCriterionImperativeForEstablishment(criterion, "SAD_MIXTE")).toBe(true);
  });

  it("le nombre total d'impératifs correspond à 16 (Aide) et 17 (Mixte) sur un lot réaliste", () => {
    // cf. .claude/context/02-referentiel-has.md §4 — 16 critères communs + 3.6.2 en plus pour Mixte.
    const communs = [
      "2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.2.6", "2.2.7",
      "3.11.1", "3.11.2", "3.12.1", "3.12.2", "3.12.3",
      "3.13.1", "3.13.2", "3.13.3", "3.14.1", "3.14.2",
    ].map((code) => ({ code, requirementLevel: "IMPERATIF" as const }));
    const circuitMedicament = { code: "3.6.2", requirementLevel: "STANDARD" as const };
    const autresStandards = [
      { code: "1.1.1", requirementLevel: "STANDARD" as const },
      { code: "2.2.1", requirementLevel: "STANDARD" as const },
    ];
    const lot = [...communs, circuitMedicament, ...autresStandards];

    const countFor = (type: "SAD_AIDE" | "SAD_MIXTE") =>
      lot.filter((c) => isCriterionImperativeForEstablishment(c, type)).length;

    expect(countFor("SAD_AIDE")).toBe(16);
    expect(countFor("SAD_MIXTE")).toBe(17);
  });
});
