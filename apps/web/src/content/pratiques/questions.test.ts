import { describe, expect, it } from "vitest";
import { PROPOSED_MATRIX_CSV } from "@/content/criteres/matrice-proposition";
import { pairKey, parseProposedMatrix } from "@/lib/services/criterion-matrix-service";
import { PRACTICE_QUESTIONNAIRE } from "./questions";

// RÈGLE ZÉRO pour la v02 (« les questions s'appuient sur le manuel HAS ») : chaque
// question cite sa source, couvre exactement les impératifs SAD, n'emploie aucun mot
// écarté et ne rattache que des types de document que la matrice propose.

// Les 16 impératifs SAD aide + 3.6.2 SAD mixte (context/02 §4).
const SAD_AIDE_IMPERATIVES = [
  "2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.2.6", "2.2.7",
  "3.11.1", "3.11.2", "3.12.1", "3.12.2", "3.12.3",
  "3.13.1", "3.13.2", "3.13.3", "3.14.1", "3.14.2",
];
const SAD_MIXTE_EXTRA = ["3.6.2"];

// Motifs assemblés par morceaux : `content-guard.test.ts` parcourt aussi ce fichier.
const FORBIDDEN: readonly RegExp[] = [
  // `\b` ne voit pas la fin d'un mot qui finit par « é » : une lettre ne doit pas suivre.
  new RegExp(["\\bfor", "m(?:er|é|ée|és|ées|ez|ons|ent|ation|ations)(?![a-zà-ÿ])"].join(""), "i"), // « sensibiliser »
  new RegExp(["\\bDI", "PEC\\b|\\bDP", "EC\\b"].join(""), "i"), // sigle DIPEC seulement
  /conforme/i, // jamais promis côté structure
  /Sandrine/i, // D7 : jamais un prénom côté client
];

const matrixPairs = new Set(parseProposedMatrix(PROPOSED_MATRIX_CSV).map((r) => pairKey(r.documentTypeCode, r.criterionCode)));

describe("questions sur les pratiques — v02 appuyée sur le manuel HAS", () => {
  const questions = PRACTICE_QUESTIONNAIRE.questions;

  it("couvre exactement les 16 impératifs SAD aide + 3.6.2 SAD mixte, une fois chacun", () => {
    const codes = questions.map((q) => q.criterionCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect([...codes].sort()).toEqual([...SAD_AIDE_IMPERATIVES, ...SAD_MIXTE_EXTRA].sort());
  });

  it("reste provisoire et cite le manuel HAS de juillet 2025", () => {
    expect(PRACTICE_QUESTIONNAIRE.provisional).toBe(true);
    expect(PRACTICE_QUESTIONNAIRE.sourceLabel).toBe("Source : Manuel HAS juillet 2025");
    expect(PRACTICE_QUESTIONNAIRE.version).toMatch(/^v02\b/);
  });

  it("chaque question a une source non vide : page du manuel, méthode du chapitre, au moins un E.E.", () => {
    for (const q of questions) {
      expect(q.source.manualPage, q.criterionCode).toBeGreaterThanOrEqual(80);
      expect(q.source.manualPage, q.criterionCode).toBeLessThanOrEqual(221);
      // Chapitre 2 → traceur ciblé ; chapitre 3 → audit système (manuel, fiches 4 et 5).
      const expectedMethod = q.criterionCode.startsWith("2.") ? "TRACEUR_CIBLE" : "AUDIT_SYSTEME";
      expect(q.source.method, q.criterionCode).toBe(expectedMethod);
      expect(q.source.evaluationElements.length, q.criterionCode).toBeGreaterThan(0);
      for (const element of q.source.evaluationElements) expect(element.trim().length).toBeGreaterThan(10);
    }
  });

  it("toutes les formulations sont reprises (version ≥ 2) : les réponses v1 s'affichent « à revoir »", () => {
    for (const q of questions) expect(q.version, q.criterionCode).toBeGreaterThanOrEqual(2);
  });

  it("FALC : une question courte, fermée, et une aide d'une seule phrase", () => {
    for (const q of questions) {
      expect(q.question.length, q.criterionCode).toBeLessThanOrEqual(120);
      expect(q.question.endsWith("?"), q.criterionCode).toBe(true);
      expect(q.proofHint.startsWith("L'évaluateur"), q.criterionCode).toBe(true);
      expect(q.proofHint.length, q.criterionCode).toBeLessThanOrEqual(160);
      // Une phrase : un seul point final, aucun autre point suivi d'une majuscule.
      expect(q.proofHint.endsWith("."), q.criterionCode).toBe(true);
      expect(q.proofHint.slice(0, -1), q.criterionCode).not.toMatch(/[.!?]\s+[A-ZÀ-Ý]/);
    }
  });

  it("n'emploie aucun mot écarté, dans aucun champ", () => {
    const text = JSON.stringify(PRACTICE_QUESTIONNAIRE);
    for (const pattern of FORBIDDEN) expect(text).not.toMatch(pattern);
  });

  it("ne rattache que des types de document que la matrice propose pour CE critère", () => {
    for (const q of questions) {
      expect(new Set(q.expectedDocumentTypeCodes).size, q.criterionCode).toBe(q.expectedDocumentTypeCodes.length);
      for (const code of q.expectedDocumentTypeCodes) {
        expect(matrixPairs.has(pairKey(code, q.criterionCode)), `${code} → ${q.criterionCode}`).toBe(true);
      }
    }
  });

  it("la règle des mots écartés mord bien", () => {
    const [verb] = FORBIDDEN;
    expect(verb!.test(["Avez-vous ", "formé l'équipe ?"].join(""))).toBe(true);
    expect(verb!.test("Votre équipe est-elle sensibilisée ?")).toBe(false);
    expect(verb!.test("Un format clair, une plateforme.")).toBe(false);
  });
});
