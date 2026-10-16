import { describe, expect, it } from "vitest";
import { QUIZ_MODULES } from "@/content/quiz";
import { PRACTICE_QUESTIONNAIRE } from "@/content/pratiques/questions";
import { SURVEY_TEMPLATES } from "@/content/enquete";
import { RECEPTION_DOCUMENTS } from "@/content/enquete/reception";
import { DISCOVERY_GRID } from "@/content/decouverte/grille";
import { buildContentReviewCatalog, CONTENT_REVIEW_STATUS, countReviewItems } from "./content-review-service";

const catalog = buildContentReviewCatalog(new Map([["L2002_LIVRET_ACCUEIL", "Livret d'accueil"]]));
const family = (id: string) => catalog.families.find((f) => f.id === id)!;
const valueOf = (fields: readonly { label: string; value: string }[], label: string) => fields.find((f) => f.label === label)?.value;

describe("buildContentReviewCatalog — tout le contenu provisoire, rien d'oublié", () => {
  it("les cinq familles, dans l'ordre, et le statut « à valider par Sandrine »", () => {
    expect(catalog.families.map((f) => f.id)).toEqual(["QUIZ", "PRATIQUES", "ENQUETE", "DECOUVERTE", "RECEPTION"]);
    expect(catalog.status).toBe(CONTENT_REVIEW_STATUS);
    expect(CONTENT_REVIEW_STATUS).toMatch(/à valider par Sandrine/);
  });

  it("quiz : un groupe par module, versionné, chaque question avec bonne réponse, explication et source", () => {
    const quiz = family("QUIZ");
    expect(quiz.groups.map((g) => g.version)).toEqual(QUIZ_MODULES.map((m) => `v${m.version}`));
    expect(countReviewItems(quiz)).toBe(QUIZ_MODULES.reduce((n, m) => n + m.questions.length, 0));

    const quizModule = QUIZ_MODULES[0]!;
    const question = quizModule.questions[0]!;
    const item = quiz.groups[0]!.items[0]!;
    const correct = question.choices.find((c) => c.id === question.correctChoiceId)!;
    expect(item.title).toBe(`1. ${question.prompt}`);
    expect(valueOf(item.fields, "Bonne réponse")).toBe(`${correct.id}) ${correct.label}`);
    expect(valueOf(item.fields, "Explication")).toBe(question.explanation);
    expect(valueOf(item.fields, "Source")).toBe(question.source);
  });

  it("pratiques : critère, question, aide, source, documents attendus (libellé quand il est connu)", () => {
    const practices = family("PRATIQUES");
    expect(practices.groups[0]!.version).toBe(PRACTICE_QUESTIONNAIRE.version);
    expect(countReviewItems(practices)).toBe(PRACTICE_QUESTIONNAIRE.questions.length);

    const first = PRACTICE_QUESTIONNAIRE.questions[0]!;
    const item = practices.groups[0]!.items[0]!;
    expect(item.title).toContain(first.criterionCode);
    expect(valueOf(item.fields, "Aide")).toBe(first.proofHint);
    expect(valueOf(item.fields, "Source")).toContain(`p. ${first.source.manualPage}`);
    const expected = valueOf(item.fields, "Documents attendus") ?? "";
    expect(expected).toContain("Livret d'accueil");
    expect(expected).not.toContain("L2002_LIVRET_ACCUEIL");
  });

  it("enquête : chaque question des deux questionnaires, plus l'introduction et le bloc données", () => {
    const survey = family("ENQUETE");
    expect(survey.groups).toHaveLength(SURVEY_TEMPLATES.length);
    SURVEY_TEMPLATES.forEach((template, index) => {
      expect(survey.groups[index]!.items).toHaveLength(template.questions.length + 2);
    });
  });

  it("découverte et feuille de réception : chaque champ, chaque point", () => {
    expect(countReviewItems(family("DECOUVERTE"))).toBe(DISCOVERY_GRID.sections.reduce((n, s) => n + s.fields.length, 0));
    expect(countReviewItems(family("RECEPTION"))).toBe(RECEPTION_DOCUMENTS.reduce((n, d) => n + d.points.length, 0));
  });

  it("n'affiche jamais un champ vide, et garde un code de document inconnu tel quel", () => {
    const bare = buildContentReviewCatalog();
    for (const f of bare.families) {
      for (const group of f.groups) for (const item of group.items) for (const field of item.fields) expect(field.value.trim()).not.toBe("");
    }
    const firstPractice = bare.families[1]!.groups[0]!.items[0]!;
    expect(valueOf(firstPractice.fields, "Documents attendus")).toContain("L2002_");
  });
});
