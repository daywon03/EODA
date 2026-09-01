import { describe, expect, it } from "vitest";
import {
  compareCriteria,
  compareCriterion,
  formatDelta,
  sortForReview,
  summariseComparison,
  type CriterionComparisonInput,
} from "./evaluation-comparison-service";

function input(overrides: Partial<CriterionComparisonInput> = {}): CriterionComparisonInput {
  return {
    code: "2.1.1.1",
    label: "Critère",
    requirementLevel: "STANDARD",
    previousRatings: [],
    currentRatings: [],
    ...overrides,
  };
}

describe("compareCriterion", () => {
  it("mesure une progression sur le score du critère", () => {
    const result = compareCriterion(
      input({ previousRatings: ["R2", "R2"], currentRatings: ["R3", "R4"] })
    );
    expect(result.previousScore).toBe(2);
    expect(result.currentScore).toBe(3.5);
    expect(result.delta).toBe(1.5);
    expect(result.trend).toBe("PROGRESSION");
  });

  it("mesure un recul", () => {
    const result = compareCriterion(
      input({ previousRatings: ["R4"], currentRatings: ["R2"] })
    );
    expect(result.delta).toBe(-2);
    expect(result.trend).toBe("REGRESSION");
  });

  it("dit STABLE et non « progression de 0 »", () => {
    expect(
      compareCriterion(input({ previousRatings: ["R3"], currentRatings: ["R3"] })).trend
    ).toBe("STABLE");
  });

  // Le piège central : un critère coté d'un seul côté n'est pas un progrès de +4.
  it("refuse de comparer ce qui n'a été coté que d'un côté", () => {
    const result = compareCriterion(input({ currentRatings: ["R4"] }));
    expect(result.trend).toBe("INCOMPARABLE");
    expect(result.delta).toBeNull();
    expect(result.previousScore).toBeNull();
  });

  it("traite un critère entièrement NC comme incomparable — NC sort du calcul", () => {
    const result = compareCriterion(
      input({ previousRatings: ["NC"], currentRatings: ["NC"] })
    );
    expect(result.trend).toBe("INCOMPARABLE");
  });

  it("compte ★ comme 4, y compris dans un écart", () => {
    const result = compareCriterion(
      input({ previousRatings: ["R3"], currentRatings: ["STAR"] })
    );
    expect(result.delta).toBe(1);
  });
});

describe("summariseComparison", () => {
  const comparisons = compareCriteria([
    input({ code: "A", previousRatings: ["R2"], currentRatings: ["R4"] }),
    input({ code: "B", previousRatings: ["R4"], currentRatings: ["R2"] }),
    input({ code: "C", previousRatings: ["R3"], currentRatings: ["R3"] }),
    input({ code: "D", currentRatings: ["R3"] }),
  ]);

  it("compte chaque tendance", () => {
    expect(summariseComparison(comparisons)).toMatchObject({
      comparable: 3,
      progression: 1,
      regression: 1,
      stable: 1,
      incomparable: 1,
    });
  });

  it("calcule les moyennes sur les seuls critères comparables", () => {
    // Sinon l'écart mesurerait surtout ce qui a été coté, pas ce qui a progressé.
    const summary = summariseComparison(comparisons);
    expect(summary.previousAverage).toBe(3);
    expect(summary.currentAverage).toBe(3);
    expect(summary.averageDelta).toBe(0);
  });

  it("remonte les impératifs passés sous 4", () => {
    const summary = summariseComparison(
      compareCriteria([
        input({
          code: "3.6.1",
          requirementLevel: "IMPERATIF",
          previousRatings: ["R4"],
          currentRatings: ["R3"],
        }),
        input({
          code: "3.7.1",
          requirementLevel: "IMPERATIF",
          previousRatings: ["R3"],
          currentRatings: ["R2"],
        }),
      ])
    );
    // Seul le premier ÉTAIT à 4 : le second était déjà à risque, ce n'est pas une
    // perte de conformité mais un manque déjà connu.
    expect(summary.imperatifsRegressed).toEqual(["3.6.1"]);
  });
});

describe("sortForReview", () => {
  it("met les reculs en tête, impératifs d'abord", () => {
    const sorted = sortForReview(
      compareCriteria([
        input({ code: "P", previousRatings: ["R2"], currentRatings: ["R3"] }),
        input({ code: "R-STD", previousRatings: ["R4"], currentRatings: ["R2"] }),
        input({
          code: "R-IMP",
          requirementLevel: "IMPERATIF",
          previousRatings: ["R4"],
          currentRatings: ["R2"],
        }),
        input({ code: "X" }),
      ])
    );
    expect(sorted.map((c) => c.code)).toEqual(["R-IMP", "R-STD", "P", "X"]);
  });
});

describe("formatDelta", () => {
  it("signe l'écart et le rend lisible en français", () => {
    expect(formatDelta(1.5)).toBe("+1,50");
    expect(formatDelta(-0.25)).toBe("−0,25");
    expect(formatDelta(0)).toBe("=");
    expect(formatDelta(null)).toBe("—");
  });
});
