import { describe, expect, it } from "vitest";
import type { DiscoveryGrid } from "@/content/decouverte/types";
import {
  discoveryCompletionPercent,
  discoveryFields,
  discoveryGrid,
  discoveryHighlights,
  HIGHLIGHTED_DISCOVERY_FIELDS,
  isDiscoveryStarted,
  normaliseDiscoveryAnswers,
  parseDiscoverySubmission,
} from "./discovery-grid-service";

// Grille de test réduite : les tests ne doivent pas casser à chaque question ajoutée
// au contenu réel. Deux tests ciblent quand même la grille livrée — ses identifiants
// sont des clés de stockage, un doublon y serait une perte de données silencieuse.
const GRID: DiscoveryGrid = {
  version: "test",
  sections: [
    {
      id: "s1",
      title: "Section 1",
      purpose: "…",
      fields: [
        { id: "libre", label: "Champ libre", kind: "SHORT_TEXT" },
        { id: "long", label: "Champ long", kind: "LONG_TEXT" },
        { id: "choix", label: "Choix", kind: "CHOICE", options: ["Oui", "Non"] },
      ],
    },
  ],
};

describe("normaliseDiscoveryAnswers", () => {
  it("rend un dictionnaire vide sur une valeur qui n'est pas un objet", () => {
    expect(normaliseDiscoveryAnswers(null, GRID)).toEqual({});
    expect(normaliseDiscoveryAnswers("bonjour", GRID)).toEqual({});
    expect(normaliseDiscoveryAnswers([1, 2], GRID)).toEqual({});
  });

  it("ignore les clés absentes de la grille courante", () => {
    expect(normaliseDiscoveryAnswers({ libre: "a", question_supprimee: "b" }, GRID)).toEqual({
      libre: "a",
    });
  });

  it("ignore les valeurs qui ne sont pas du texte", () => {
    expect(normaliseDiscoveryAnswers({ libre: 42, long: { a: 1 }, choix: "Oui" }, GRID)).toEqual({
      choix: "Oui",
    });
  });

  it("traite une réponse blanche comme absente", () => {
    expect(normaliseDiscoveryAnswers({ libre: "   " }, GRID)).toEqual({});
  });

  it("écarte un choix hors liste — l'afficher laisserait croire qu'il est proposé", () => {
    expect(normaliseDiscoveryAnswers({ choix: "Peut-être" }, GRID)).toEqual({});
  });
});

describe("parseDiscoverySubmission", () => {
  it("applique au formulaire exactement les règles de la lecture", () => {
    const entries: [string, string][] = [
      ["libre", " Réponse "],
      ["choix", "Non"],
      ["inconnu", "x"],
    ];
    expect(parseDiscoverySubmission(entries, GRID)).toEqual({ libre: "Réponse", choix: "Non" });
  });
});

describe("discoveryCompletionPercent", () => {
  it("compte les questions renseignées sur le total", () => {
    expect(discoveryCompletionPercent({}, GRID)).toBe(0);
    expect(discoveryCompletionPercent({ libre: "a" }, GRID)).toBe(33);
    expect(discoveryCompletionPercent({ libre: "a", long: "b", choix: "Oui" }, GRID)).toBe(100);
  });
});

describe("isDiscoveryStarted", () => {
  it("distingue « réunion non tenue » de « réunion sans réponse notée »", () => {
    expect(isDiscoveryStarted({})).toBe(false);
    expect(isDiscoveryStarted({ libre: "a" })).toBe(true);
  });
});

describe("grille livrée", () => {
  it("n'a aucun identifiant de question en doublon — ce sont les clés de stockage", () => {
    const ids = discoveryFields(discoveryGrid()).map((field) => field.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("déclare des options sur tout champ à choix, sinon le champ serait insaisissable", () => {
    for (const field of discoveryFields(discoveryGrid())) {
      if (field.kind === "CHOICE") expect(field.options?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("remonte les points saillants renseignés, et seulement eux", () => {
    const highlights = discoveryHighlights({
      decideur: "Direction seule",
      // Renseignée mais non saillante : elle ne doit pas remonter.
      besoin: "Préparer l'évaluation de janvier",
    });
    expect(highlights).toEqual([
      { label: "Qui décide en dernier ressort ?", value: "Direction seule" },
    ]);
  });

  // RÈGLE ZÉRO. `HIGHLIGHTED_DISCOVERY_FIELDS` est une liste de chaînes : rien dans le
  // langage ne la rattache à la grille. Au passage en v03, les trois identifiants
  // qu'elle contenait avaient disparu du contenu — les points saillants étaient
  // silencieusement vides, sans erreur ni avertissement. Ce test est le seul contrôle
  // qui le dit.
  it("ne désigne comme saillant que des questions qui existent vraiment", () => {
    const ids = new Set(discoveryFields(discoveryGrid()).map((field) => field.id));
    for (const highlighted of HIGHLIGHTED_DISCOVERY_FIELDS) {
      expect(ids.has(highlighted), `question saillante absente de la grille : ${highlighted}`).toBe(
        true
      );
    }
  });
});
