import { describe, expect, it } from "vitest";
import { findQuizModule, QUIZ_MODULE_CODES, QUIZ_MODULES } from "./index";

// Contenu des quiz : versions, seuil, retest, forme FALC, et aucune donnée réelle.

describe("modules de quiz livrés", () => {
  it("cinq modules, dans l'ordre des codes", () => {
    expect(QUIZ_MODULES.map((m) => m.code)).toEqual([...QUIZ_MODULE_CODES]);
    expect(new Set(QUIZ_MODULES.map((m) => m.code)).size).toBe(QUIZ_MODULES.length);
  });

  it.each(QUIZ_MODULES.map((m) => [m.code, m] as const))("%s : version, seuil, retest, provisoire", (_code, quiz) => {
    expect(Number.isInteger(quiz.version)).toBe(true);
    expect(quiz.version).toBeGreaterThanOrEqual(1);
    expect(quiz.passThreshold).toBeGreaterThanOrEqual(0.5);
    expect(quiz.passThreshold).toBeLessThanOrEqual(1);
    expect(quiz.retestMonths).toBe(6);
    expect(quiz.provisional).toBe(true);
    expect(quiz.sources.length).toBeGreaterThan(0);
    expect(quiz.questions.length).toBeGreaterThanOrEqual(6);
    expect(quiz.questions.length).toBeLessThanOrEqual(8);
  });

  it("identifiants de questions uniques sur tous les modules", () => {
    const ids = QUIZ_MODULES.flatMap((m) => m.questions.map((q) => q.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(QUIZ_MODULES.flatMap((m) => m.questions.map((q) => [q.id, q] as const)))(
    "%s : bonne réponse parmi les choix, question courte",
    (_id, question) => {
      expect(question.choices.length).toBeGreaterThanOrEqual(2);
      expect(question.choices.map((c) => c.id)).toContain(question.correctChoiceId);
      expect(new Set(question.choices.map((c) => c.id)).size).toBe(question.choices.length);
      expect(question.prompt.length).toBeLessThanOrEqual(120);
      expect(question.explanation.length).toBeGreaterThan(0);
    }
  );

  it("la bonne réponse ne tombe pas toujours au même endroit", () => {
    for (const quiz of QUIZ_MODULES) {
      expect(new Set(quiz.questions.map((q) => q.correctChoiceId)).size).toBeGreaterThan(1);
    }
  });

  it("aucun nom réel, et « sensibiliser » jamais « former »", () => {
    const texts = staffVisibleTexts();
    // Motif assemblé : le nom du client pilote ne s'écrit nulle part, même dans un test.
    const forbidden = new RegExp(["AS", "SAD|Sandrine|\\bformer\\b|\\bformations?\\b"].join(""), "i");
    for (const text of texts) expect(text).not.toMatch(forbidden);
  });
});

// Textes que voit le salarié (titre, question, choix, explication) — jamais la source.
function staffVisibleTexts(): string[] {
  return QUIZ_MODULES.flatMap((m) => [
    m.title,
    m.shortTitle,
    ...m.questions.flatMap((q) => [q.prompt, q.explanation, ...q.choices.map((c) => c.label)]),
  ]);
}

describe("sources du manuel HAS et FALC", () => {
  it.each(QUIZ_MODULES.map((m) => [m.code, m] as const))("%s : mention « Manuel HAS juillet 2025 »", (_code, quiz) => {
    expect(quiz.sources.some((s) => s.startsWith("Manuel HAS juillet 2025"))).toBe(true);
  });

  it.each(QUIZ_MODULES.flatMap((m) => m.questions.map((q) => [q.id, q] as const)))(
    "%s : source précise et non vide",
    (_id, question) => {
      expect(question.source.trim().length).toBeGreaterThan(0);
      // Une page du manuel, une section de context/10 ou 11, ou l'aveu « hors manuel ».
      expect(question.source).toMatch(/p\. \d+|context\/1[01]|hors manuel/i);
    }
  );

  it("aucun jargon d'évaluation ni sigle non expliqué dans ce que lit le salarié", () => {
    const forbidden =
      /\bE\.\s?E\.|traceur|élément d'évaluation|\bcrit[èe]res?\b|impératif|\bESSMS\b|Synaé|\bDIPE?C\b|\bDPEC\b|\bEIG?\b|\bPCA\b/i;
    for (const text of staffVisibleTexts()) expect(text).not.toMatch(forbidden);
  });

  it("les identifiants de questions portent la version du module (une réponse d'une ancienne version est ignorée)", () => {
    for (const quiz of QUIZ_MODULES) {
      for (const question of quiz.questions) expect(question.id).toContain(`-v${quiz.version}-`);
    }
  });
});

describe("findQuizModule", () => {
  it("retrouve un module par son code, refuse un code inconnu", () => {
    expect(findQuizModule("PLAINTES")?.title).toBe("Plaintes et réclamations");
    expect(findQuizModule("INCONNU")).toBeNull();
  });
});
