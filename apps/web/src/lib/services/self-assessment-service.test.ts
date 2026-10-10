import { describe, expect, it } from "vitest";
import type { Rating } from "@eoda/database";
import { computeCriterionScore, computeWeightedAverage } from "./scoring-service";
import {
  countByFilter,
  countRatedElements,
  describeAssessmentScope,
  describeAverageMeasure,
  describeChapterRatedMeasure,
  describeRatingAuthor,
  isProposedByPlatform,
  matchesFilter,
  type CriterionFacts,
  type ElementFacts,
} from "./self-assessment-service";

// Règles de référence : .claude/context/02-referentiel-has.md §3 ; écarts de la
// maquette corrigés : plan v2 §4 (« Proposé par la plateforme », jamais « 141 »).

const RATED_AT = new Date(2026, 9, 8, 10, 0);

function el(over: Partial<ElementFacts> = {}): ElementFacts {
  return { rating: null, suggestedBySystem: false, confirmedByUser: false, ratedAt: null, ratedByName: null, ...over };
}

function rated(rating: Rating, over: Partial<ElementFacts> = {}): ElementFacts {
  return el({ rating, confirmedByUser: true, ratedAt: RATED_AT, ratedByName: "Consultante (fictive)", ...over });
}

function crit(requirementLevel: CriterionFacts["requirementLevel"], elements: ElementFacts[]): CriterionFacts {
  return { requirementLevel, elements };
}

describe("describeRatingAuthor — machine ou humain, jamais confondus", () => {
  it("une suggestion non confirmée est « Proposé par la plateforme », jamais « EODA »", () => {
    const suggestion = el({ suggestedBySystem: true });
    expect(isProposedByPlatform(suggestion)).toBe(true);
    expect(describeRatingAuthor(suggestion)).toEqual({ text: "Proposé par la plateforme", kind: "platform" });
  });

  it("un geste humain dit qui et quand", () => {
    expect(describeRatingAuthor(rated("R3"))).toEqual({
      text: "Coté par Consultante (fictive) · 08/10/2026",
      kind: "human",
    });
  });

  it("une suggestion confirmée par un clic devient un geste humain", () => {
    expect(describeRatingAuthor(rated("R4", { suggestedBySystem: true })).kind).toBe("human");
  });

  it("cotation sans auteur connu : la date seule, sans deviner le nom", () => {
    expect(describeRatingAuthor(rated("R2", { ratedByName: null })).text).toBe("Coté le 08/10/2026");
    expect(describeRatingAuthor(rated("R2", { ratedByName: null, ratedAt: null })).text).toBe("Coté");
  });

  it("rien de coté", () => {
    expect(describeRatingAuthor(el())).toEqual({ text: "Pas encore coté", kind: "none" });
  });
});

describe("filtres — par critère, à partir de ses éléments", () => {
  const imperatifComplet = crit("IMPERATIF", [rated("R4"), rated("STAR")]);
  const standardBas = crit("STANDARD", [rated("R2"), el()]);
  const standardPropose = crit("STANDARD", [el({ suggestedBySystem: true })]);
  const standardNc = crit("STANDARD", [rated("NC"), rated("R1")]);
  const all = [imperatifComplet, standardBas, standardPropose, standardNc];

  it("compte chaque filtre", () => {
    expect(countByFilter(all)).toEqual({ ALL: 4, IMPERATIFS: 1, UNRATED: 2, LOW: 2, PROPOSED: 1 });
  });

  it("« Cotés 1 ou 2 » ne retient ni NC, ni ★, ni 3", () => {
    expect(matchesFilter(crit("STANDARD", [rated("NC"), rated("STAR"), rated("R3")]), "LOW")).toBe(false);
    expect(matchesFilter(standardNc, "LOW")).toBe(true);
  });

  it("« Proposés par la plateforme » exclut une suggestion déjà confirmée", () => {
    expect(matchesFilter(crit("STANDARD", [rated("R4", { suggestedBySystem: true })]), "PROPOSED")).toBe(false);
  });
});

describe("cartes de synthèse", () => {
  it("compte NC et RI comme cotés, pas une suggestion", () => {
    const criteria = [crit("STANDARD", [rated("NC"), rated("RI"), el({ suggestedBySystem: true }), rated("R3")])];
    expect(countRatedElements(criteria)).toEqual({ rated: 3, total: 4 });
  });

  it("moyenne : ★ compte 4, NC est exclu (jamais 0)", () => {
    // Chapitre A : ★ + NC + 2 → (4 + 2) / 2 = 3 ; chapitre B : 4. Moyenne = 3,5.
    const chapterA = computeWeightedAverage([{ score: computeCriterionScore(["STAR", "NC", "R2"]) }]);
    const chapterB = computeWeightedAverage([{ score: computeCriterionScore(["R4"]) }]);
    expect(chapterA).toBe(3);
    expect(describeAverageMeasure([chapterA, chapterB, null])).toEqual({
      label: "Moyenne des cotations",
      value: "3,5 / 4",
      percent: 88,
      note: "Tout à fait satisfaisant · ★ compte 4, NC et RI hors moyenne",
    });
  });

  it("rien de coté : « Non coté », sans jauge", () => {
    const measure = describeAverageMeasure([null, null]);
    expect(measure.value).toBe("Non coté");
    expect(measure).not.toHaveProperty("percent");
  });

  it("chapitre : éléments cotés x / y", () => {
    expect(describeChapterRatedMeasure({ number: 1, name: "La personne" }, { rated: 12, total: 48 })).toEqual({
      label: "Chapitre 1 — La personne",
      value: "12 / 48",
      percent: 25,
      note: "Éléments d'évaluation cotés",
    });
    expect(describeChapterRatedMeasure({ number: 2, name: "" }, { rated: 0, total: 0 }).percent).toBe(0);
  });
});

describe("describeAssessmentScope — le périmètre exact, jamais « 141 »", () => {
  it("dit le nombre lu en base et la grille", () => {
    const text = describeAssessmentScope({ criteriaCount: 137, imperativesOnly: false, establishmentType: "SAD_AIDE" });
    expect(text).toBe("Auto-évaluation préparatoire · 137 critères (grille Synaé SAD aide)");
    expect(text).not.toMatch(/141|157/);
  });

  it("offre restreinte aux impératifs", () => {
    expect(describeAssessmentScope({ criteriaCount: 16, imperativesOnly: true, establishmentType: "SAD_AIDE" })).toBe(
      "Auto-évaluation préparatoire · 16 critères impératifs (grille Synaé SAD aide) · périmètre de l'offre souscrite"
    );
  });

  it("un SAD mixte est prévenu que sa grille est incomplète", () => {
    expect(
      describeAssessmentScope({ criteriaCount: 1, imperativesOnly: false, establishmentType: "SAD_MIXTE" })
    ).toMatch(/1 critère \(grille Synaé SAD aide\) — les critères propres au SAD mixte ne sont pas encore chargés$/);
  });
});
