import { describe, expect, it } from "vitest";
import {
  analysisVisibleTo,
  describeAnalysis,
  isAnalysisAwaitingReview,
  parseAnalysisResult,
  summariseAnalysis,
} from "./analysis-view-service";

const COMPLETE = {
  elementsPresents: ["Objet du séjour"],
  elementsManquants: ["Mention des voies de recours"],
  suggestionsCorrection: ["Ajouter un paragraphe sur la personne qualifiée."],
  sembleConforme: false,
};

describe("parseAnalysisResult", () => {
  it("lit une analyse complète", () => {
    expect(parseAnalysisResult(COMPLETE)).toEqual(COMPLETE);
  });

  it("rend null sur une colonne vide ou d'un autre type", () => {
    // La colonne est `Json?` : elle vaut null tant qu'aucune analyse n'a abouti.
    expect(parseAnalysisResult(null)).toBeNull();
    expect(parseAnalysisResult("analyse")).toBeNull();
    expect(parseAnalysisResult([1, 2])).toBeNull();
  });

  it("rend null sur le résultat vide de l'adaptateur de repli", () => {
    // StubAnalysisAdapter renvoie exactement ça en développement : l'afficher ferait
    // passer un document non analysé pour un document sans reproche.
    expect(
      parseAnalysisResult({
        elementsPresents: [],
        elementsManquants: [],
        suggestionsCorrection: [],
        sembleConforme: false,
      })
    ).toBeNull();
  });

  it("garde une analyse qui conclut à la conformité sans rien lister", () => {
    const parsed = parseAnalysisResult({
      elementsPresents: [],
      elementsManquants: [],
      suggestionsCorrection: [],
      sembleConforme: true,
    });
    expect(parsed?.sembleConforme).toBe(true);
  });

  it("ignore les entrées non textuelles au lieu de casser la page", () => {
    // Une analyse écrite sous un contrat plus ancien ne doit pas faire tomber toute
    // la checklist six mois plus tard.
    const parsed = parseAnalysisResult({
      elementsPresents: ["ok", 42, null, { a: 1 }],
      elementsManquants: "pas un tableau",
      suggestionsCorrection: ["  ", "utile"],
      sembleConforme: "oui",
    });

    expect(parsed).toEqual({
      elementsPresents: ["ok"],
      elementsManquants: [],
      suggestionsCorrection: ["utile"],
      // Seul `true` vaut vrai : « oui » n'est pas une conformité.
      sembleConforme: false,
    });
  });
});

describe("summariseAnalysis", () => {
  it("compte sans réinterpréter la conclusion du modèle", () => {
    expect(summariseAnalysis(COMPLETE)).toEqual({
      missingCount: 1,
      suggestionCount: 1,
      presentCount: 1,
      seemsCompliant: false,
    });
  });
});

describe("describeAnalysis", () => {
  it("accorde le pluriel", () => {
    expect(
      describeAnalysis({ missingCount: 3, suggestionCount: 0, presentCount: 0, seemsCompliant: false })
    ).toContain("3 éléments attendus n'ont pas été retrouvés");
  });

  it("reste au singulier pour un seul manque", () => {
    expect(
      describeAnalysis({ missingCount: 1, suggestionCount: 0, presentCount: 0, seemsCompliant: false })
    ).toContain("1 élément attendu n'a pas été retrouvé");
  });

  it("ne conclut jamais à la conformité à la place de l'évaluatrice", () => {
    // La plateforme prépare, elle ne décide pas (CLAUDE.md §1) : aucune formulation
    // ne doit annoncer un document « conforme » sans renvoyer à une confirmation.
    const sansManque = describeAnalysis({
      missingCount: 0,
      suggestionCount: 0,
      presentCount: 2,
      seemsCompliant: true,
    });
    expect(sansManque).toContain("confirmer");
    expect(sansManque).not.toMatch(/\bconforme\b/);
  });
});

describe("analysisVisibleTo — revue humaine obligatoire (CDC §5, §7)", () => {
  const reviewed = { analysis: COMPLETE, reviewedAt: new Date("2026-08-26") };
  const pending = { analysis: COMPLETE, reviewedAt: null };

  it("ne montre RIEN au client tant que la consultante n'a pas revu", () => {
    // Le cas qui compte : une analyse produite par un modèle, lue directement par le
    // client, ferait dire au cabinet des choses qu'il n'a pas vérifiées — sur des
    // documents qui seront présentés à la HAS.
    expect(analysisVisibleTo("CLIENT", pending)).toBeNull();
  });

  it("montre l'analyse au client une fois la revue faite", () => {
    expect(analysisVisibleTo("CLIENT", reviewed)).toEqual(COMPLETE);
  });

  it("montre tout au cabinet, revue ou non — c'est son travail de relire", () => {
    expect(analysisVisibleTo("CABINET", pending)).toEqual(COMPLETE);
    expect(analysisVisibleTo("CABINET", reviewed)).toEqual(COMPLETE);
  });

  it("ne fabrique pas d'analyse là où il n'y en a pas", () => {
    expect(analysisVisibleTo("CABINET", { analysis: null, reviewedAt: null })).toBeNull();
    expect(analysisVisibleTo("CLIENT", { analysis: null, reviewedAt: new Date() })).toBeNull();
  });
});

describe("isAnalysisAwaitingReview", () => {
  it("distingue « en attente de relecture » de « pas d'analyse »", () => {
    expect(isAnalysisAwaitingReview({ analysis: COMPLETE, reviewedAt: null })).toBe(true);
    expect(isAnalysisAwaitingReview({ analysis: null, reviewedAt: null })).toBe(false);
    expect(isAnalysisAwaitingReview({ analysis: COMPLETE, reviewedAt: new Date() })).toBe(false);
  });
});
