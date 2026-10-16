import { describe, expect, it } from "vitest";
import { surveyTemplateFor } from "@/content/enquete";
import { MAX_FREE_TEXT_LENGTH, parseSurveyAnswers } from "./survey-answer-parser";

const PERSONNE = surveyTemplateFor("PERSONNE");
const json = (value: unknown) => JSON.stringify(value);

describe("parseSurveyAnswers — entrée hostile", () => {
  it("accepte des choix de l'échelle et des textes, ignore un texte vide", () => {
    const result = parseSurveyAnswers(
      PERSONNE,
      json([
        { questionId: "p01-respect", choice: "TRES" },
        { questionId: "p10-appel-crise", choice: "NON_CONCERNE" },
        { questionId: "p13-message", freeText: "  Merci  " },
        { questionId: "p08b-regle-proposee", freeText: "   " },
      ])
    );
    expect(result).toEqual({
      ok: true,
      value: [
        { questionId: "p01-respect", choice: "TRES", freeText: null },
        { questionId: "p10-appel-crise", choice: "NON_CONCERNE", freeText: null },
        { questionId: "p13-message", choice: null, freeText: "Merci" },
      ],
    });
  });

  it.each([
    ["absent", undefined],
    ["pas du JSON", "{"],
    ["pas un tableau", json({ a: 1 })],
    ["trop long", "x".repeat(40_001)],
  ])("refuse un champ %s", (_label, raw) => {
    expect(parseSurveyAnswers(PERSONNE, raw).ok).toBe(false);
  });

  it("refuse une question inconnue, en double, ou un élément non objet", () => {
    expect(parseSurveyAnswers(PERSONNE, json([{ questionId: "f01-relation", choice: "TRES" }])).ok).toBe(false);
    expect(
      parseSurveyAnswers(PERSONNE, json([{ questionId: "p01-respect", choice: "TRES" }, { questionId: "p01-respect", choice: "PAS" }])).ok
    ).toBe(false);
    expect(parseSurveyAnswers(PERSONNE, json(["p01-respect"])).ok).toBe(false);
  });

  it("refuse un choix hors de l'échelle de la question (PLUTOT n'existe pas en FALC)", () => {
    expect(parseSurveyAnswers(PERSONNE, json([{ questionId: "p01-respect", choice: "PLUTOT" }]))).toEqual({
      ok: false,
      error: "Une réponse n'existe pas pour cette question.",
    });
  });

  it("refuse un texte trop long et une enquête sans aucun choix", () => {
    expect(parseSurveyAnswers(PERSONNE, json([{ questionId: "p13-message", freeText: "a".repeat(MAX_FREE_TEXT_LENGTH + 1) }])).ok).toBe(false);
    expect(parseSurveyAnswers(PERSONNE, json([{ questionId: "p13-message", freeText: "Bien" }]))).toEqual({
      ok: false,
      error: "L'enquête ne contient aucune réponse.",
    });
  });
});
