import { describe, expect, it } from "vitest";
import { normalizeVerdictNote, parseVerdict, summarizeAnalysis, tallyByVariant } from "./analysis-lab-service";

describe("summarizeAnalysis", () => {
  it("compte ce qu'un essai a trouvé, pour le comparer d'un coup d'œil", () => {
    expect(
      summarizeAnalysis({
        elementsPresents: [{ text: "a", source: "a" }],
        elementsManquants: ["x", "y"],
        suggestionsCorrection: [],
        sembleConforme: false,
        criteriaCoverage: [
          { criterionCode: "1", criterionLabel: "", status: "couvert", note: "" },
          { criterionCode: "2", criterionLabel: "", status: "partiel", note: "" },
          { criterionCode: "3", criterionLabel: "", status: "absent", note: "" },
        ],
        criteresSupplementaires: [{ criterionCode: "4", justification: "" }],
        natureObservee: { correspondAuType: false, commentaire: "" },
      })
    ).toEqual({ present: 1, missing: 2, suggestions: 0, covered: 1, partial: 1, absent: 1, extraCriteria: 1, natureMismatch: true });
  });
});

describe("verdict", () => {
  it("n'accepte que BON ou A_REVOIR", () => {
    expect(parseVerdict("BON")).toBe("BON");
    expect(parseVerdict("A_REVOIR")).toBe("A_REVOIR");
    expect(parseVerdict("PARFAIT")).toBeNull();
  });

  it("note : resserrée, bornée, vide = aucune", () => {
    expect(normalizeVerdictNote("  trop de   critères ")).toBe("trop de critères");
    expect(normalizeVerdictNote("   ")).toBeNull();
    expect(normalizeVerdictNote(null)).toBeNull();
    expect(normalizeVerdictNote("x".repeat(1001))).toEqual({ error: expect.stringMatching(/1000/) });
    expect(normalizeVerdictNote(42)).toEqual({ error: "Note invalide." });
  });
});

describe("tallyByVariant", () => {
  it("compte essais, bons, à revoir et non jugés par version", () => {
    expect(
      tallyByVariant([
        { promptVariant: "cible", verdict: "BON" },
        { promptVariant: "cible", verdict: null },
        { promptVariant: "actuel", verdict: "A_REVOIR" },
      ])
    ).toEqual([
      { variant: "cible", trials: 2, good: 1, toReview: 0, unjudged: 1 },
      { variant: "actuel", trials: 1, good: 0, toReview: 1, unjudged: 0 },
    ]);
  });
});
