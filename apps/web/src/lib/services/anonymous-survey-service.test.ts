import { describe, expect, it } from "vitest";
import { SURVEY_SCALES, SURVEY_TEMPLATES, surveyTemplateFor } from "@/content/enquete";
import {
  anonymousQuestions,
  completedOnFor,
  parseAnonymousAnswers,
  parseLinkCount,
  respondentKindFor,
  toSurveyRecord,
} from "./anonymous-survey-service";

const PERSONNE = surveyTemplateFor("PERSONNE");

// Pour chaque question, la réponse qui n'engage rien (« Ne se prononce pas », « Cela
// ne m'est pas arrivé »).
function fullAnswers(code: "PERSONNE" | "FAMILLE" = "PERSONNE"): Record<string, string> {
  return Object.fromEntries(
    anonymousQuestions(surveyTemplateFor(code)).map((q) => [q.id, SURVEY_SCALES[q.scale].options.find((o) => o.weight === null)!.choice])
  );
}

describe("anonymousQuestions", () => {
  it.each(SURVEY_TEMPLATES.map((t) => [t.code, t] as const))("%s : ni texte libre, ni contrôle de dossier", (_code, template) => {
    const kept = anonymousQuestions(template);
    expect(kept.length).toBeGreaterThan(0);
    for (const q of kept) {
      expect(q.kind).toBe("SCALE");
      expect(q.tag).not.toBe("CONTROLE_DOSSIER");
      expect(SURVEY_SCALES[q.scale].isControl).toBe(false);
    }
    // Toutes les questions libres du questionnaire sont bien écartées.
    expect(template.questions.filter((q) => q.kind === "TEXT").some((q) => kept.some((k) => k.id === q.id))).toBe(false);
  });

  it("chaque échelle retenue a une réponse qui n'engage rien : on peut toujours répondre", () => {
    for (const template of SURVEY_TEMPLATES) {
      for (const q of anonymousQuestions(template)) {
        expect(SURVEY_SCALES[q.scale].options.some((o) => o.weight === null)).toBe(true);
      }
    }
  });
});

describe("parseAnonymousAnswers — entrée hostile", () => {
  it("accepte une réponse de l'échelle à chaque question", () => {
    const parsed = parseAnonymousAnswers(PERSONNE, JSON.stringify(fullAnswers()));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toHaveLength(anonymousQuestions(PERSONNE).length);
  });

  it("refuse un texte libre, même glissé sous l'identifiant d'une vraie question libre", () => {
    const textQuestion = PERSONNE.questions.find((q) => q.kind === "TEXT")!;
    const parsed = parseAnonymousAnswers(PERSONNE, JSON.stringify({ ...fullAnswers(), [textQuestion.id]: "Mme Martin, diabétique" }));
    expect(parsed).toEqual({ ok: false, error: "Une réponse ne correspond à aucune question." });
  });

  it("refuse une question de contrôle de dossier", () => {
    const control = PERSONNE.questions.find((q) => q.kind === "SCALE" && q.tag === "CONTROLE_DOSSIER")!;
    expect(parseAnonymousAnswers(PERSONNE, JSON.stringify({ ...fullAnswers(), [control.id]: "NSP" })).ok).toBe(false);
  });

  it("refuse un choix hors échelle, une réponse manquante, un format illisible", () => {
    const [first] = anonymousQuestions(PERSONNE);
    expect(parseAnonymousAnswers(PERSONNE, JSON.stringify({ ...fullAnswers(), [first!.id]: "A" })).ok).toBe(false);
    const missing = fullAnswers();
    delete missing[first!.id];
    expect(parseAnonymousAnswers(PERSONNE, JSON.stringify(missing)).ok).toBe(false);
    expect(parseAnonymousAnswers(PERSONNE, "[]").ok).toBe(false);
    expect(parseAnonymousAnswers(PERSONNE, "pas du json").ok).toBe(false);
    expect(parseAnonymousAnswers(PERSONNE, null).ok).toBe(false);
  });
});

describe("règles de forme", () => {
  it("garde le jour, jamais l'heure", () => {
    expect(completedOnFor(new Date("2026-10-21T17:42:13.000Z")).toISOString()).toBe("2026-10-21T00:00:00.000Z");
  });

  it("borne le nombre de liens", () => {
    expect(parseLinkCount("10")).toBe(10);
    expect(parseLinkCount("0")).toBeNull();
    expect(parseLinkCount("101")).toBeNull();
    expect(parseLinkCount("1e3")).toBeNull();
    expect(parseLinkCount(null)).toBeNull();
  });

  it("une réponse anonyme se dépouille sans personne ni texte", () => {
    expect(respondentKindFor("FAMILLE")).toBe("PROCHE");
    const record = toSurveyRecord({
      id: "r1",
      templateCode: "PERSONNE",
      templateVersion: 1,
      respondentKind: "PERSONNE",
      mode: "SEULE",
      completedOn: new Date("2026-10-21T00:00:00.000Z"),
      answers: [{ questionId: "p12-global", choice: "TRES" }],
    });
    expect(record.beneficiaryId).toBeNull();
    expect(record.answers).toEqual([{ questionId: "p12-global", choice: "TRES", freeText: null }]);
  });
});
