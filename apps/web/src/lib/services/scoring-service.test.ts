import { describe, expect, it } from "vitest";
import {
  computeCriterionScore,
  computeWeightedAverage,
  isRatingAllowed,
  ratingValue,
  scoreLabel,
} from "./scoring-service";

// Règles de référence : .claude/context/02-referentiel-has.md §3.1-§3.2.
// Ces tests existent parce que ce sont exactement les règles que CLAUDE.md §3 signale
// comme des pièges si elles sont reconstituées de mémoire : ★ = 4 (jamais 5), NC/RI
// exclus de la moyenne (jamais comptés 0), RI réservé au Chapitre 1.

describe("ratingValue — §3.1", () => {
  it("mappe 1-4 sur leur valeur numérique", () => {
    expect(ratingValue("R1")).toBe(1);
    expect(ratingValue("R2")).toBe(2);
    expect(ratingValue("R3")).toBe(3);
    expect(ratingValue("R4")).toBe(4);
  });

  it("traite ★ comme un 4, jamais comme un 5 ou un bonus", () => {
    expect(ratingValue("STAR")).toBe(4);
  });

  it("exclut NC et RI du calcul (null, et non 0)", () => {
    expect(ratingValue("NC")).toBeNull();
    expect(ratingValue("RI")).toBeNull();
  });
});

describe("computeCriterionScore — §3.4 agrégation", () => {
  it("fait la moyenne des E.E. cotés", () => {
    expect(computeCriterionScore(["R2", "R4"])).toBe(3);
  });

  it("exclut NC du dénominateur au lieu de le compter 0", () => {
    // Si NC comptait 0, la moyenne serait 2 au lieu de 4 — l'erreur classique.
    expect(computeCriterionScore(["R4", "NC"])).toBe(4);
  });

  it("exclut RI du dénominateur", () => {
    expect(computeCriterionScore(["R3", "RI"])).toBe(3);
  });

  it("renvoie null quand aucun E.E. n'est coté ou que tout est exclu", () => {
    expect(computeCriterionScore([])).toBeNull();
    expect(computeCriterionScore(["NC", "RI"])).toBeNull();
  });

  it("compte ★ comme 4 dans la moyenne", () => {
    expect(computeCriterionScore(["STAR", "R2"])).toBe(3);
  });
});

describe("computeWeightedAverage — point d'extension pondération §3.4", () => {
  it("fait une moyenne simple quand aucun poids n'est fourni (V1)", () => {
    expect(computeWeightedAverage([{ score: 2 }, { score: 4 }])).toBe(3);
  });

  it("ignore les enfants non cotés au lieu de les compter 0", () => {
    expect(computeWeightedAverage([{ score: 4 }, { score: null }])).toBe(4);
  });

  it("applique la pondération quand elle est renseignée (extension V2)", () => {
    // 10 % sur un objectif à 1, 90 % sur un objectif à 4 → 3,7.
    const result = computeWeightedAverage([
      { score: 1, weightPercent: 10 },
      { score: 4, weightPercent: 90 },
    ]);
    expect(result).toBeCloseTo(3.7, 5);
  });

  it("retombe sur une moyenne simple si la somme des poids est nulle", () => {
    expect(
      computeWeightedAverage([
        { score: 2, weightPercent: 0 },
        { score: 4, weightPercent: 0 },
      ])
    ).toBe(3);
  });

  it("renvoie null sur une liste vide ou entièrement non cotée", () => {
    expect(computeWeightedAverage([])).toBeNull();
    expect(computeWeightedAverage([{ score: null }])).toBeNull();
  });
});

describe("isRatingAllowed — §3.2 règles 1 et 2", () => {
  it("autorise RI sur le Chapitre 1", () => {
    expect(isRatingAllowed("RI", 1, "STANDARD").allowed).toBe(true);
  });

  it("interdit RI hors Chapitre 1", () => {
    expect(isRatingAllowed("RI", 2, "STANDARD").allowed).toBe(false);
    expect(isRatingAllowed("RI", 3, "STANDARD").allowed).toBe(false);
  });

  it("autorise NC sur un critère impératif mais avec avertissement — garde-fou pédagogique, pas blocage", () => {
    const result = isRatingAllowed("NC", 3, "IMPERATIF");
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeTruthy();
  });

  it("n'avertit pas sur NC pour un critère standard", () => {
    expect(isRatingAllowed("NC", 3, "STANDARD")).toEqual({ allowed: true });
  });

  it("n'entrave jamais une cotation 1-4 ou ★", () => {
    for (const rating of ["R1", "R2", "R3", "R4", "STAR"] as const) {
      expect(isRatingAllowed(rating, 3, "IMPERATIF").allowed).toBe(true);
    }
  });
});

describe("scoreLabel — §3.2 règle 5 (échelle indicative)", () => {
  it("applique les bornes exactes de l'échelle", () => {
    expect(scoreLabel(4)).toBe("Tout à fait satisfaisant");
    expect(scoreLabel(3.5)).toBe("Tout à fait satisfaisant");
    expect(scoreLabel(3.49)).toBe("Plutôt satisfaisant");
    expect(scoreLabel(2.5)).toBe("Plutôt satisfaisant");
    expect(scoreLabel(2.49)).toBe("Plutôt pas satisfaisant");
    expect(scoreLabel(1.5)).toBe("Plutôt pas satisfaisant");
    expect(scoreLabel(1.49)).toBe("Pas du tout satisfaisant");
  });

  it("distingue « non coté » d'un score bas", () => {
    expect(scoreLabel(null)).toBe("Non coté");
  });
});
