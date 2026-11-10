import { describe, expect, it } from "vitest";
import { PROPOSED_MATRIX_CSV } from "@/content/criteres/matrice-proposition";
import { ESTABLISHMENT_ONLY_CRITERIA } from "@/content/criteres/hors-perimetre-sad";
import { parseProposedMatrix } from "./criterion-matrix-service";
import { unknownCriteriaMessage } from "./criterion-code-message";

// Retour du 09/11/2026 : « Critère inconnu du référentiel : 2.4.1 » faisait croire à une
// faute de frappe. 2.4.1 existe dans le manuel HAS, mais son champ est « Établissement » :
// il ne s'applique pas à un service à domicile, donc il n'est pas dans les grilles SAD
// chargées en base. Le message doit le dire.

describe("unknownCriteriaMessage", () => {
  it("un critère du manuel réservé aux établissements est dit hors périmètre SAD, pas inconnu", () => {
    const message = unknownCriteriaMessage(["2.4.1"]);
    expect(message).toContain("2.4.1");
    expect(message).toContain("hors périmètre SAD");
    expect(message).toContain("ne s'applique pas à un service à domicile");
    expect(message).not.toContain("inconnu");
  });

  it("un code absent du manuel connu : absent des grilles SAD, avec la piste du périmètre", () => {
    expect(unknownCriteriaMessage(["9.9.9"])).toBe(
      "Critère absent des grilles SAD : 9.9.9. Vérifiez le code ou son périmètre (un critère « Établissement » ne s'applique pas à un SAD)."
    );
  });

  it("plusieurs codes : chaque famille nommée une fois, dans l'ordre reçu", () => {
    expect(unknownCriteriaMessage(["9.9.9", "1.4.2", "3.2.2", "8.8.8"])).toBe(
      "Critères hors périmètre SAD : 1.4.2, 3.2.2 (critères du manuel HAS réservés aux établissements, qui ne s'appliquent pas à un service à domicile). " +
        "Critères absents des grilles SAD : 9.9.9, 8.8.8. Vérifiez le code ou son périmètre (un critère « Établissement » ne s'applique pas à un SAD)."
    );
  });

  it("liste vide : aucun message", () => {
    expect(unknownCriteriaMessage([])).toBe("");
  });
});

describe("liste des critères « Établissement » (RÈGLE ZÉRO)", () => {
  it("reprend exactement les codes que la matrice proposée annote « Établissement » d'après le manuel", () => {
    const fromMatrix = new Set(
      parseProposedMatrix(PROPOSED_MATRIX_CSV)
        .filter((row) => row.remark?.includes("| Établissement |"))
        .map((row) => row.criterionCode)
    );
    expect([...ESTABLISHMENT_ONLY_CRITERIA].sort()).toEqual([...fromMatrix].sort());
  });
});
