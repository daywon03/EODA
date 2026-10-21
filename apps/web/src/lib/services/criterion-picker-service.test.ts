import { describe, expect, it } from "vitest";
import {
  compareCriterionCodes,
  countImperatives,
  groupCriteriaForPicker,
  type PickerCriterion,
} from "./criterion-picker-service";

function criterion(
  code: string,
  overrides: Partial<PickerCriterion> = {}
): PickerCriterion {
  return {
    id: `id-${code}`,
    code,
    label: `Critère ${code}`,
    requirementLevel: "STANDARD",
    chapterNumber: 1,
    chapterName: "Chapitre 1",
    themeCode: "1.1",
    themeName: "Thème 1.1",
    ...overrides,
  };
}

describe("compareCriterionCodes", () => {
  it("range les segments numériquement, pas alphabétiquement", () => {
    // Piège classique : en tri de chaînes, « 1.7.10 » passe AVANT « 1.7.9 ».
    expect(compareCriterionCodes("1.7.9", "1.7.10")).toBeLessThan(0);
    expect(compareCriterionCodes("1.10", "1.9")).toBeGreaterThan(0);
  });

  it("utilise la longueur quand un code préfixe l'autre", () => {
    expect(compareCriterionCodes("1.7", "1.7.1")).toBeLessThan(0);
    expect(compareCriterionCodes("1.7.1", "1.7")).toBeGreaterThan(0);
  });
});

describe("groupCriteriaForPicker", () => {
  it("regroupe par chapitre puis par thématique", () => {
    const groups = groupCriteriaForPicker([
      criterion("1.2.1", { chapterNumber: 1, themeCode: "1.2", themeName: "Thème 1.2" }),
      criterion("2.1.1", { chapterNumber: 2, chapterName: "Chapitre 2", themeCode: "2.1" }),
      criterion("1.1.1", { chapterNumber: 1, themeCode: "1.1", themeName: "Thème 1.1" }),
    ]);

    expect(groups.map((g) => g.number)).toEqual([1, 2]);
    expect(groups[0]?.themes.map((t) => t.code)).toEqual(["1.1", "1.2"]);
    expect(groups[0]?.criteriaCount).toBe(2);
  });

  it("place les impératifs en tête de leur thématique, puis trie par code", () => {
    // Le critère impératif a le code le plus grand : s'il sort premier, c'est bien
    // le niveau d'exigence qui a décidé, pas l'alphabet.
    const groups = groupCriteriaForPicker([
      criterion("1.1.1"),
      criterion("1.1.9", { requirementLevel: "IMPERATIF" }),
      criterion("1.1.2"),
    ]);

    expect(groups[0]?.themes[0]?.criteria.map((c) => c.code)).toEqual([
      "1.1.9",
      "1.1.1",
      "1.1.2",
    ]);
    expect(groups[0]?.imperativesCount).toBe(1);
  });

  it("ne garde que les impératifs, et retire les groupes devenus vides", () => {
    const groups = groupCriteriaForPicker(
      [
        criterion("1.1.1", { requirementLevel: "IMPERATIF" }),
        criterion("1.1.2"),
        criterion("2.1.1", { chapterNumber: 2, chapterName: "Chapitre 2", themeCode: "2.1" }),
      ],
      { imperativesOnly: true }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]?.number).toBe(1);
    expect(groups[0]?.themes).toHaveLength(1);
    expect(groups[0]?.themes[0]?.criteria.map((c) => c.code)).toEqual(["1.1.1"]);
  });

  it("filtre sur le code ou l'intitulé, sans tenir compte de la casse", () => {
    const groups = groupCriteriaForPicker(
      [
        criterion("1.1.1", { label: "La personne est informée" }),
        criterion("1.1.2", { label: "Le dossier est constitué" }),
      ],
      { query: "INFORMÉE" }
    );

    expect(groups[0]?.themes[0]?.criteria.map((c) => c.code)).toEqual(["1.1.1"]);
  });

  it("rend une liste vide plutôt qu'un groupe vide quand rien ne correspond", () => {
    const groups = groupCriteriaForPicker([criterion("1.1.1")], { query: "introuvable" });
    expect(groups).toEqual([]);
  });
});

describe("countImperatives", () => {
  it("compte les impératifs du référentiel chargé", () => {
    expect(
      countImperatives([
        criterion("1.1.1", { requirementLevel: "IMPERATIF" }),
        criterion("1.1.2"),
        criterion("1.1.3", { requirementLevel: "IMPERATIF" }),
      ])
    ).toBe(2);
  });
});
