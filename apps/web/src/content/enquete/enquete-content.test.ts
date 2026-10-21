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
import { SURVEY_FAMILLE } from "./famille";
import { SURVEY_PERSONNE } from "./personne";
import { RECEPTION_DOCUMENTS, RECEPTION_POINTS_PROVISIONAL } from "./reception";

// Contenu de l'enquête — tenu à la transcription du gabarit de Sandrine (v1.0 du
// 30/09) et à sa grille de dépouillement (v02 du 07/10).

const scaleCount = (code: "PERSONNE" | "FAMILLE") =>
  surveyTemplateFor(code).questions.filter((q) => q.kind === "SCALE").length;

describe("questionnaires", () => {
  it("16 questions côté personne, 19 côté famille (hors textes libres) — V1.6 enrichie du 21/10", () => {
    expect(scaleCount("PERSONNE")).toBe(16);
    expect(scaleCount("FAMILLE")).toBe(19);
  });

  it("suit la numérotation du questionnaire papier V1.6 enrichie", () => {
    const scaleIds = (code: "PERSONNE" | "FAMILLE") =>
      surveyTemplateFor(code).questions.filter((q) => q.kind === "SCALE").map((q) => q.id);
    // Personne : 4 à 8 = droits (choix des aides … accord), 12 = règlement, 16 = global.
    const personne = scaleIds("PERSONNE");
    expect(personne.slice(3, 8)).toEqual([
      "p04-choix-aides",
      "p04b-personne-confiance",
      "p04c-acces-dossier",
      "p04d-explication",
      "p04e-accord",
    ]);
    expect(personne[11]).toBe("p08-reglement");
    expect(personne[15]).toBe("p12-global");
    expect(personne).not.toContain("p04-avis");
    // Famille : 4 à 8 = « à votre connaissance », 18 = règlement, 19 = global.
    const famille = scaleIds("FAMILLE");
    expect(famille[3]).toBe("f03b-personne-confiance");
    expect(famille[7]).toBe("f03f-choix-aides");
    expect(famille[17]).toBe("f13-reglement");
    expect(famille[18]).toBe("f14-global");
  });

  it("garde « Je ne sais plus » côté personne et « Je ne sais pas » côté proches, hors calcul", () => {
    const labels = (code: keyof typeof SURVEY_SCALES) => SURVEY_SCALES[code].options.map((o) => o.label);
    expect(labels("OUI_EN_PARTIE")).toEqual(["Oui", "En partie", "Non", "Je ne sais plus"]);
    expect(labels("OUI_PARFOIS")).toEqual(["Oui", "Parfois", "Non", "Je ne sais plus"]);
    expect(labels("OUI_NON")).toEqual(["Oui", "Non", "Je ne sais plus"]);
    expect(labels("PROCHE_EN_PARTIE")).toEqual(["Oui", "En partie", "Non", "Je ne sais pas"]);
    expect(labels("PROCHE_PARFOIS")).toEqual(["Oui", "Parfois", "Non", "Je ne sais pas"]);
    for (const code of ["OUI_EN_PARTIE", "OUI_PARFOIS", "OUI_NON", "PROCHE_EN_PARTIE", "PROCHE_PARFOIS"] as const) {
      expect(SURVEY_SCALES[code].options.find((o) => o.choice === "NSP")?.weight).toBeNull();
    }
  });

  it("n'a aucun identifiant de question en double", () => {
    for (const template of SURVEY_TEMPLATES) {
      const ids = template.questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  // Le nom du pilote est refusé dans tout le dépôt par lib/design/content-guard.test.ts ;
  // ici : aucun numéro de téléphone recopié du gabarit.
  it("ne recopie aucun numéro de téléphone", () => {
    const text = JSON.stringify(SURVEY_TEMPLATES);
    expect(text).not.toMatch(/\d{2} \d{2} \d{2} \d{2} \d{2}/);
  });

  it("porte un bloc RGPD et une question de contrôle hors taux par questionnaire", () => {
    for (const template of SURVEY_TEMPLATES) {
      expect(template.privacyNotice).toContain("CNIL");
      const control = template.questions.filter((q) => q.kind === "SCALE" && SURVEY_SCALES[q.scale].isControl);
      expect(control).toHaveLength(1);
    }
  });

  // Le gabarit famille demande, après les avis libres, « Votre lien avec la personne
  // accompagnée (facultatif) : ☐ conjoint(e) ☐ enfant ☐ autre : .... ». Il ne compte
  // ni dans les 19 questions cotées, ni dans les taux.
  it("demande le lien avec la personne accompagnée, facultatif et hors taux (gabarit famille)", () => {
    const choices = SURVEY_FAMILLE.questions.filter((q) => q.kind === "CHOICE");
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      id: "f17-lien",
      options: ["Conjoint(e)", "Enfant", "Autre"],
      otherOption: "Autre",
    });
    expect(SURVEY_PERSONNE.questions.filter((q) => q.kind === "CHOICE")).toHaveLength(0);
    expect(scaleCount("FAMILLE")).toBe(19);
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
  });
});
