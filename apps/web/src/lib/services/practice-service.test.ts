import { describe, expect, it } from "vitest";
import { PRACTICE_QUESTIONNAIRE } from "@/content/pratiques/questions";
import {
  FALLBACK_QUESTION_VERSION,
  MAX_PRACTICE_TEXT_LENGTH,
  describeLinkedDocuments,
  describePracticeProgress,
  isAnswerCurrent,
  latestAnswersByCriterion,
  parsePracticeAnswer,
  parseQuestionIndex,
  resolvePracticeQuestions,
  validatePracticeText,
  type ImperativeForPractice,
  type PracticeAnswerFacts,
} from "./practice-service";

// Les 16 impératifs SAD aide + 3.6.2 SAD mixte (context/02 §4).
const IMPERATIVE_CODES = [
  "2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.2.6", "2.2.7",
  "3.11.1", "3.11.2", "3.12.1", "3.12.2", "3.12.3",
  "3.13.1", "3.13.2", "3.13.3", "3.14.1", "3.14.2", "3.6.2",
];

function imperative(code: string, overrides: Partial<ImperativeForPractice> = {}): ImperativeForPractice {
  return { id: `c-${code}`, code, label: `Intitulé ${code}`, status: "SANS_PREUVE", expectedDocumentTypeIds: [], ...overrides };
}

describe("contenu versionné des questions", () => {
  it("une question par impératif connu, aucune en double, aucune inventée", () => {
    const codes = PRACTICE_QUESTIONNAIRE.questions.map((q) => q.criterionCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort()).toEqual([...IMPERATIVE_CODES].sort());
  });

  it("FALC et prudence : versions ≥ 1, questions courtes, provisoires, sans prénom de l'équipe", () => {
    expect(PRACTICE_QUESTIONNAIRE.provisional).toBe(true);
    for (const q of PRACTICE_QUESTIONNAIRE.questions) {
      expect(q.version).toBeGreaterThanOrEqual(1);
      expect(q.question.length).toBeLessThanOrEqual(120);
      expect(q.question.endsWith("?") || q.question.endsWith(".")).toBe(true);
    }
    expect(JSON.stringify(PRACTICE_QUESTIONNAIRE)).not.toMatch(/Sandrine|conforme/i); // sigle et pilote : content-guard.test.ts
  });
});

describe("resolvePracticeQuestions", () => {
  it("une question par impératif de la structure, dans l'ordre des codes ; jamais 3.6.2 chez un SAD aide", () => {
    const aide = IMPERATIVE_CODES.filter((c) => c !== "3.6.2").map((c) => imperative(c));
    const questions = resolvePracticeQuestions(aide, PRACTICE_QUESTIONNAIRE);
    expect(questions).toHaveLength(16);
    expect(questions.map((q) => q.criterionCode)).not.toContain("3.6.2");
    expect(questions[0]!.criterionCode).toBe("2.2.2");
    expect(questions.at(-1)!.criterionCode).toBe("3.14.2");
    expect(questions.every((q) => !q.isFallback)).toBe(true);
  });

  it("un impératif sans question écrite reçoit une formulation de repli tirée de son intitulé", () => {
    const [q] = resolvePracticeQuestions([imperative("9.9.9", { label: "Nouveau critère" })], PRACTICE_QUESTIONNAIRE);
    expect(q).toMatchObject({ isFallback: true, version: FALLBACK_QUESTION_VERSION, criterionId: "c-9.9.9" });
    expect(q!.question).toContain("Nouveau critère");
  });
});

describe("réponses", () => {
  it.each(["OUI", "EN_PARTIE", "PAS_ENCORE", "NE_SAIS_PAS"])("accepte %s", (value) => {
    expect(parsePracticeAnswer(value)).toBe(value);
  });

  it.each([null, undefined, "", "oui", "CONFORME", 1, ["OUI"]])("refuse une réponse invalide (%s)", (value) => {
    expect(parsePracticeAnswer(value)).toBeNull();
  });

  it("valide le texte libre : vide → null, trop long → refus, pas une chaîne → refus", () => {
    expect(validatePracticeText("  ")).toEqual({ ok: true, text: null });
    expect(validatePracticeText(undefined)).toEqual({ ok: true, text: null });
    expect(validatePracticeText(" On rappelle la famille. ")).toEqual({ ok: true, text: "On rappelle la famille." });
    expect(validatePracticeText("x".repeat(MAX_PRACTICE_TEXT_LENGTH + 1)).ok).toBe(false);
    expect(validatePracticeText(42).ok).toBe(false);
  });

  const answer = (criterionId: string, day: number, questionVersion = 1): PracticeAnswerFacts => ({
    criterionId,
    questionVersion,
    answer: "OUI",
    text: null,
    answeredAt: new Date(2026, 9, day),
  });

  it("la plus récente par critère fait foi (append-only)", () => {
    const latest = latestAnswersByCriterion([answer("a", 2), answer("a", 5, 2), answer("a", 3), answer("b", 1)]);
    expect(latest.get("a")?.questionVersion).toBe(2);
    expect(latest.size).toBe(2);
  });

  it("une réponse donnée sous une ancienne formulation n'est plus à jour", () => {
    expect(isAnswerCurrent(answer("a", 1, 1), { version: 1 })).toBe(true);
    expect(isAnswerCurrent(answer("a", 1, 1), { version: 2 })).toBe(false);
    expect(isAnswerCurrent(undefined, { version: 1 })).toBe(false);
  });

  it("compte la progression sur les réponses à jour seulement", () => {
    const questions = resolvePracticeQuestions([imperative("3.12.1"), imperative("3.14.1")], PRACTICE_QUESTIONNAIRE);
    // La version courante vient du contenu : une reformulation ne casse pas ce test.
    const v = (code: string) => questions.find((q) => q.criterionCode === code)!.version;
    const progress = describePracticeProgress(questions, latestAnswersByCriterion([answer("c-3.12.1", 1, v("3.12.1"))]));
    expect(progress).toEqual({ answered: 1, total: 2, label: "1 réponse sur 2" });
    expect(
      describePracticeProgress(
        questions,
        latestAnswersByCriterion([answer("c-3.12.1", 1, v("3.12.1")), answer("c-3.14.1", 1, v("3.14.1"))])
      ).label
    ).toBe("2 réponses sur 2");
    // Une réponse donnée sous une formulation antérieure ne compte pas.
    expect(describePracticeProgress(questions, latestAnswersByCriterion([answer("c-3.12.1", 1, v("3.12.1") - 1)])).answered).toBe(0);
  });
});

describe("document lié et navigation", () => {
  it("cite les types attendus de la matrice et leur statut de preuve, jamais « conforme »", () => {
    const labels = new Map([
      ["t1", "Procédure plaintes"],
      ["t2", "Registre des plaintes"],
    ]);
    expect(describeLinkedDocuments(imperative("3.12.1"), labels)).toBe("Document lié : aucun pour le moment.");
    expect(describeLinkedDocuments(imperative("3.12.1", { expectedDocumentTypeIds: ["t1"], status: "PROUVE" }), labels)).toBe(
      "Document lié : Procédure plaintes — prouvé."
    );
    expect(describeLinkedDocuments(imperative("3.12.1", { expectedDocumentTypeIds: ["t1", "t2", "inconnu"] }), labels)).toBe(
      "Documents liés : Procédure plaintes, Registre des plaintes — sans preuve."
    );
  });

  it("borne l'index de question lu dans l'adresse", () => {
    expect(parseQuestionIndex(undefined, 16)).toBe(0);
    expect(parseQuestionIndex("3", 16)).toBe(2);
    expect(parseQuestionIndex("99", 16)).toBe(15);
    expect(parseQuestionIndex("-4", 16)).toBe(0);
    expect(parseQuestionIndex("abc", 16)).toBe(0);
    expect(parseQuestionIndex(["2"], 16)).toBe(0);
    expect(parseQuestionIndex("2", 0)).toBe(0);
  });
});
