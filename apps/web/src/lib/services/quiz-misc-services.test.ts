import { describe, expect, it } from "vitest";
import type { QuizModule } from "@/content/quiz/types";
import { isComplete, sanitizeAnswers, scoreQuiz } from "./quiz-scoring-service";
import { qrMatrix, qrPathData } from "./quiz-qr-service";
import { buildSignoffCsv, neutralizeCsvCell } from "./quiz-signoff-service";
import { describeImportResult, planStaffImport, STAFF_IMPORT_MAX_LINES } from "./staff-import-service";

const QUIZ: QuizModule = {
  code: "BIENTRAITANCE",
  version: 2,
  title: "Bientraitance",
  shortTitle: "Bientraitance",
  pictogram: "heart",
  passThreshold: 0.8,
  retestMonths: 6,
  provisional: true,
  sources: [],
  questions: Array.from({ length: 5 }, (_, i) => ({
    id: `q${i}`,
    prompt: `Question ${i}`,
    choices: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    correctChoiceId: "a",
    explanation: "Parce que.",
    pictogram: "hand" as const,
    source: "Fixture de test.",
  })),
};

describe("correction d'un quiz — calculée par le serveur", () => {
  it("4 sur 5 avec un seuil de 80 % : réussi", () => {
    expect(scoreQuiz(QUIZ, { q0: "a", q1: "a", q2: "a", q3: "a", q4: "b" })).toMatchObject({ score: 4, total: 5, passed: true });
  });

  it("3 sur 5 : à refaire", () => {
    expect(scoreQuiz(QUIZ, { q0: "a", q1: "a", q2: "a", q3: "b", q4: "b" }).passed).toBe(false);
  });

  it("ignore les questions et choix inconnus (entrée hostile)", () => {
    expect(sanitizeAnswers(QUIZ, { q0: "a", q1: "z", pirate: "a", q2: 3 })).toEqual({ q0: "a" });
    expect(sanitizeAnswers(QUIZ, "n'importe quoi")).toEqual({});
    expect(sanitizeAnswers(QUIZ, null)).toEqual({});
  });

  it("un quiz incomplet ne se corrige pas", () => {
    expect(isComplete(QUIZ, { q0: "a" })).toBe(false);
    expect(isComplete(QUIZ, { q0: "a", q1: "a", q2: "a", q3: "a", q4: "a" })).toBe(true);
  });
});

describe("QR code", () => {
  const url = "https://portail.example.org/quiz/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";

  it("produit une matrice carrée avec les trois motifs de repérage", () => {
    const matrix = qrMatrix(url);
    const size = matrix.length;
    expect(size).toBeGreaterThanOrEqual(25);
    expect(matrix.every((row) => row.length === size)).toBe(true);
    // Coins des motifs de repérage : sombres.
    expect(matrix[0]?.[0]).toBe(true);
    expect(matrix[0]?.[size - 1]).toBe(true);
    expect(matrix[size - 1]?.[0]).toBe(true);
  });

  it("rend un chemin SVG avec une zone de silence de 4 modules, sans balise", () => {
    const { size, d } = qrPathData(url);
    expect(size).toBe(qrMatrix(url).length + 8);
    expect(d.startsWith("M4 4h1v1h-1z")).toBe(true);
    expect(d).toMatch(/^[Mhvz0-9 -]+$/);
  });

  it("est déterministe", () => {
    expect(qrPathData(url)).toEqual(qrPathData(url));
  });
});

describe("émargement CSV", () => {
  const csv = buildSignoffCsv([
    { displayName: "Zoé (fictive)", jobTitle: "Aide", moduleTitle: "Plaintes", moduleVersion: 1, score: 6, total: 7, completedAt: new Date(2026, 9, 2) },
    { displayName: "=CMD()", jobTitle: "Aide; cheffe", moduleTitle: "Bientraitance", moduleVersion: 2, score: 7, total: 7, completedAt: new Date(2026, 9, 1) },
  ]);

  it("BOM, en-tête, une ligne par réussite, triées par nom", () => {
    const lines = csv.split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("﻿Personne;Métier;Quiz;Version;Score;Date");
    expect(lines[1]).toContain("'=CMD()");
    expect(lines[1]).toContain('"Aide; cheffe"');
    expect(lines[2]).toBe("Zoé (fictive);Aide;Plaintes;v1;6/7;02/10/2026");
  });

  it("neutralise les formules", () => {
    expect(neutralizeCsvCell("+33")).toBe("'+33");
    expect(neutralizeCsvCell("@x")).toBe("'@x");
    expect(neutralizeCsvCell("Aide")).toBe("Aide");
  });
});

describe("import d'une liste « nom ; métier »", () => {
  it("saute l'en-tête, accepte « ; » et « , », signale les lignes invalides avec leur numéro", () => {
    const plan = planStaffImport(
      ["nom;métier", "Fatou D. (fictive) ; Aide à domicile", "Karim B. (fictif),Auxiliaire de vie", ";Aide", "Sans métier;", "a;b;c", ""].join("\n")
    );
    expect(plan.rows).toEqual([
      { displayName: "Fatou D. (fictive)", jobTitle: "Aide à domicile" },
      { displayName: "Karim B. (fictif)", jobTitle: "Auxiliaire de vie" },
    ]);
    expect(plan.issues).toEqual([
      { line: 4, reason: "nom manquant" },
      { line: 5, reason: "métier manquant" },
      { line: 6, reason: "plus de deux colonnes" },
    ]);
  });

  it("ignore les doublons du fichier et de l'équipe existante", () => {
    const plan = planStaffImport("Anne (fictive);Aide\nanne (fictive);Aide\nPaul (fictif);Aide", ["Paul (fictif)"]);
    expect(plan.rows).toHaveLength(1);
    expect(plan.issues.map((i) => i.reason)).toEqual(["déjà dans l'équipe", "déjà dans l'équipe"]);
  });

  it("refuse un texte trop long et plafonne le nombre de lignes", () => {
    expect(planStaffImport(`${"x".repeat(121)};Aide`).issues[0]?.reason).toBe("texte trop long");
    const many = Array.from({ length: STAFF_IMPORT_MAX_LINES + 3 }, (_, i) => `P${i};Aide`).join("\n");
    const plan = planStaffImport(many);
    expect(plan.rows).toHaveLength(STAFF_IMPORT_MAX_LINES);
    expect(plan.issues).toEqual([{ line: STAFF_IMPORT_MAX_LINES + 1, reason: "trop de lignes" }]);
  });

  it("résume le résultat", () => {
    expect(describeImportResult(2, [])).toBe("2 personnes ajoutées.");
    expect(describeImportResult(1, [{ line: 3, reason: "nom manquant" }])).toBe(
      "1 personne ajoutée. 1 ligne non importée (ligne 3 : nom manquant)."
    );
  });
});
