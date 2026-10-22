import { describe, expect, it } from "vitest";
import {
  ACTION_PROPOSAL_THRESHOLD,
  findSurveyTemplate,
  missingAnswerHint,
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
  it("27 questions cotées côté personne, 28 côté famille — version du 21/10/2026", () => {
    expect(scaleCount("PERSONNE")).toBe(27);
    expect(scaleCount("FAMILLE")).toBe(28);
  });

  it("porte le numéro du papier, dans l'ordre du papier (sous-questions lettrées comprises)", () => {
    const numbers = (code: "PERSONNE" | "FAMILLE") =>
      surveyTemplateFor(code).questions.flatMap((q) => (q.kind === "CHOICE" || !q.number ? [] : [q.number]));
    expect(numbers("PERSONNE")).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "12 A",
      "13 A", "13 B", "13 C", "13 D", "14", "15", "16",
      "17 A", "17 B", "17 C", "17 D", "17 E", "17 F", "17 G", "18",
    ]);
    expect(numbers("FAMILLE")).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "11 A", "12", "13", "14", "15", "16", "17", "18",
      "18 A", "18 B", "18 C", "18 D", "18 E", "18 F", "18 G", "18 H", "19",
    ]);
  });

  it("garde les réponses écrites sur le papier, question par question", () => {
    const labels = (code: keyof typeof SURVEY_SCALES) => SURVEY_SCALES[code].options.map((o) => o.label);
    // 15 : plus de « Un peu » (remarque de Sandrine au test tablette du 21/10).
    expect(labels("CRISE")).toEqual(["Oui", "Non", "Je ne sais pas", "Cela ne m'est pas arrivé"]);
    expect(labels("CHAQUE_FOIS_PARFOIS_JAMAIS")).toEqual(["Oui, à chaque fois", "Parfois", "Non, jamais", "Je ne sais pas"]);
    expect(labels("REPONSE_REMARQUE")).toEqual(["Oui", "Non", "Je n'ai jamais fait de remarque"]);
    expect(labels("CONTROLE")).toEqual(["Oui", "Non", "Je ne sais pas"]);
  });

  it("exclut du calcul « Je ne sais pas » et les réponses « pas concerné(e) », et ne note pas un besoin", () => {
    for (const scale of Object.values(SURVEY_SCALES)) {
      for (const option of scale.options) {
        if (option.choice === "NSP" || option.choice === "NON_CONCERNE") expect(option.weight).toBeNull();
      }
    }
    // « Avez-vous besoin d'aide pour participer à la vie de votre ville ? » : un besoin.
    expect(SURVEY_SCALES.BESOIN_AIDE_VIE_SOCIALE.options.every((o) => o.weight === null)).toBe(true);
  });

  it("le message « pas de réponse » ne propose que le « je ne sais pas » de la question", () => {
    expect(missingAnswerHint(SURVEY_SCALES.REPONSE_REMARQUE.options)).toBe("Choisissez une réponse.");
    expect(missingAnswerHint(SURVEY_SCALES.CRISE.options)).toBe("Choisissez une réponse. « Je ne sais pas » en est une.");
    expect(missingAnswerHint(SURVEY_SCALES.FALC3.options)).toBe("Choisissez une réponse. « Ne se prononce pas » en est une.");
  });

  it("chaque échelle a des choix distincts (une réponse = un choix stocké)", () => {
    for (const scale of Object.values(SURVEY_SCALES)) {
      const choices = scale.options.map((o) => o.choice);
      expect(new Set(choices).size).toBe(choices.length);
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
  // ni dans les questions cotées, ni dans les taux.
  it("demande le lien avec la personne accompagnée, facultatif et hors taux (gabarit famille)", () => {
    const choices = SURVEY_FAMILLE.questions.filter((q) => q.kind === "CHOICE");
    expect(choices).toHaveLength(1);
    expect(choices[0]).toMatchObject({
      id: "f17-lien",
      options: ["Conjoint(e)", "Enfant", "Autre"],
      otherOption: "Autre",
    });
    expect(SURVEY_PERSONNE.questions.filter((q) => q.kind === "CHOICE")).toHaveLength(0);
    expect(scaleCount("FAMILLE")).toBe(28);
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
    if (first.kind === "SCALE") expect(scaleOptions(first)).toBe(SURVEY_SCALES[first.scale].options);
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
