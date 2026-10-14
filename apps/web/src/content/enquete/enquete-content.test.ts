import { describe, expect, it } from "vitest";
import {
  ACTION_PROPOSAL_THRESHOLD,
  findSurveyTemplate,
  SATISFACTION_GRADES,
  scaleOptions,
  SURVEY_SCALES,
  SURVEY_TEMPLATES,
  surveyTemplateFor,
} from "./index";
import { RECEPTION_DOCUMENTS, RECEPTION_POINTS_PROVISIONAL } from "./reception";

// Contenu de l'enquête — tenu à la transcription du gabarit de Sandrine (v1.0 du
// 30/09) et à sa grille de dépouillement (v02 du 07/10).

const scaleCount = (code: "PERSONNE" | "FAMILLE") =>
  surveyTemplateFor(code).questions.filter((q) => q.kind === "SCALE").length;

describe("questionnaires", () => {
  it("12 questions côté personne, 14 côté famille (hors textes libres)", () => {
    expect(scaleCount("PERSONNE")).toBe(12);
    expect(scaleCount("FAMILLE")).toBe(14);
  });

  it("n'a aucun identifiant de question en double", () => {
    for (const template of SURVEY_TEMPLATES) {
      const ids = template.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("ne nomme aucune structure réelle", () => {
    const text = JSON.stringify(SURVEY_TEMPLATES).toUpperCase();
    expect(text).not.toContain("ASSAD");
    expect(text).not.toContain("BENOIT");
    expect(text).not.toMatch(/\d{2} \d{2} \d{2} \d{2} \d{2}/);
  });

  it("porte un bloc RGPD et une question de contrôle hors taux par questionnaire", () => {
    for (const template of SURVEY_TEMPLATES) {
      expect(template.privacyNotice).toContain("CNIL");
      const control = template.questions.filter((q) => q.kind === "SCALE" && SURVEY_SCALES[q.scale].isControl);
      expect(control).toHaveLength(1);
    }
  });

  it("propose « Non concerné » sur l'échelle famille et l'exclut du calcul", () => {
    const options = SURVEY_SCALES.SAT5.options;
    expect(options.find((o) => o.choice === "NON_CONCERNE")).toMatchObject({ label: "Non concerné", weight: null });
  });

  it("garde les poids de la grille de dépouillement", () => {
    expect(SURVEY_SCALES.FALC3.options.map((o) => o.weight)).toEqual([1, 0.5, 0, null]);
    expect(SURVEY_SCALES.SAT5.options.slice(0, 4).map((o) => Math.round((o.weight ?? -1) * 100))).toEqual([100, 67, 33, 0]);
  });

  it("retrouve un questionnaire par code, refuse un code inconnu", () => {
    expect(findSurveyTemplate("FAMILLE")?.code).toBe("FAMILLE");
    expect(findSurveyTemplate("AUTRE")).toBeNull();
    const first = surveyTemplateFor("PERSONNE").questions[0]!;
    if (first.kind === "SCALE") expect(scaleOptions(first)).toBe(SURVEY_SCALES.FALC3.options);
  });
});

describe("seuils", () => {
  it("90 / 75 / 60, plan d'action sous 75", () => {
    expect(SATISFACTION_GRADES.map((g) => g.min)).toEqual([90, 75, 60, 0]);
    expect(ACTION_PROPOSAL_THRESHOLD).toBe(75);
  });
});

describe("feuille de réception", () => {
  it("présente livret, règlement et DIPC, chacun avec ses points, marqués provisoires", () => {
    expect(RECEPTION_DOCUMENTS.map((d) => d.kind)).toEqual(["LIVRET_REMIS", "REGLEMENT_REMIS", "DIPC"]);
    for (const doc of RECEPTION_DOCUMENTS) expect(doc.points.length).toBeGreaterThan(0);
    expect(RECEPTION_POINTS_PROVISIONAL).toBe(true);
    expect(JSON.stringify(RECEPTION_DOCUMENTS)).not.toMatch(/DIPEC|DPEC/);
  });
});
