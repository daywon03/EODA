import { describe, expect, it } from "vitest";
import { surveyTemplateFor } from "@/content/enquete";
import type { SurveyAnswerInput, SurveyChoice } from "@/lib/hds/beneficiary-data-port";
import { computeTemplateStats, gradeFor, gradeLabel, withoutFreeTexts, type SurveyResponseForStats } from "./survey-stats-service";
import { buildSurveyCsv, csvCell, proposeSurveyActions, selectSurveyActionsToCreate } from "./survey-report-service";

// Données SYNTHÉTIQUES uniquement : aucune personne, seulement des réponses.
const PERSONNE = surveyTemplateFor("PERSONNE");
const FAMILLE = surveyTemplateFor("FAMILLE");

function response(
  code: "PERSONNE" | "FAMILLE",
  choices: Record<string, SurveyChoice>,
  texts: Record<string, string> = {},
  // La version COURANTE du contenu, jamais un 1 figé : les questionnaires sont
  // versionnés et une correction de chapeau l'incrémente (v2 le 20/10/2026). Un test
  // qui écrit « version 1 » en dur casserait à chaque correction de contenu — et pire,
  // il passerait en décrivant des réponses que le service considère comme périmées.
  version = surveyTemplateFor(code).version
): SurveyResponseForStats {
  const answers: SurveyAnswerInput[] = [
    ...Object.entries(choices).map(([questionId, choice]) => ({ questionId, choice, freeText: null })),
    ...Object.entries(texts).map(([questionId, freeText]) => ({ questionId, choice: null, freeText })),
  ];
  return { templateCode: code, templateVersion: version, answers };
}

describe("gradeFor", () => {
  it("applique les seuils de la grille", () => {
    expect(gradeFor(null)).toBeNull();
    expect(gradeFor(95)).toBe("EXCELLENT");
    expect(gradeFor(90)).toBe("EXCELLENT");
    expect(gradeFor(75)).toBe("SATISFAISANT");
    expect(gradeFor(60)).toBe("A_SURVEILLER");
    expect(gradeFor(59)).toBe("ALERTE");
    expect(gradeLabel(null)).toBe("Pas encore de données");
    expect(gradeLabel("ALERTE")).toBe("Point d'alerte");
  });
});

describe("computeTemplateStats", () => {
  it("rend un tableau vide sans réponse", () => {
    const stats = computeTemplateStats(PERSONNE, []);
    expect(stats.responses).toBe(0);
    expect(stats.rate).toBeNull();
    expect(stats.questions.every((q) => q.rate === null)).toBe(true);
  });

  it("pondère FALC 3 niveaux (oui 1, un peu 0,5, non 0) et exclut NSP", () => {
    const stats = computeTemplateStats(PERSONNE, [
      response("PERSONNE", { "p01-respect": "TRES" }),
      response("PERSONNE", { "p01-respect": "PEU" }),
      response("PERSONNE", { "p01-respect": "PAS" }),
      response("PERSONNE", { "p01-respect": "NSP" }),
    ]);
    const q1 = stats.questions.find((q) => q.questionId === "p01-respect")!;
    expect(q1.answered).toBe(4);
    expect(q1.counted).toBe(3);
    expect(q1.rate).toBe(50);
    expect(q1.grade).toBe("ALERTE");
    expect(q1.distribution.find((d) => d.choice === "NSP")?.count).toBe(1);
  });

  it("exclut « Cela ne m'est pas arrivé » et « Non concerné »", () => {
    const personne = computeTemplateStats(PERSONNE, [
      response("PERSONNE", { "p10-appel-crise": "NON_CONCERNE" }),
      response("PERSONNE", { "p10-appel-crise": "TRES" }),
    ]);
    expect(personne.questions.find((q) => q.questionId === "p10-appel-crise")?.rate).toBe(100);
    const famille = computeTemplateStats(FAMILLE, [
      response("FAMILLE", { "f01-relation": "NON_CONCERNE" }),
      response("FAMILLE", { "f01-relation": "PLUTOT" }),
      response("FAMILLE", { "f01-relation": "PEU" }),
    ]);
    expect(famille.questions.find((q) => q.questionId === "f01-relation")?.rate).toBe(50);
  });

  it("tient l'indicateur de contrôle hors du taux et compte ses alertes", () => {
    const stats = computeTemplateStats(PERSONNE, [
      response("PERSONNE", { "p11-personne-a-prevenir": "PAS", "p12-global": "TRES" }),
      response("PERSONNE", { "p11-personne-a-prevenir": "NSP", "p12-global": "TRES" }),
      response("PERSONNE", { "p11-personne-a-prevenir": "TRES" }),
    ]);
    const control = stats.questions.find((q) => q.questionId === "p11-personne-a-prevenir")!;
    expect(control.isControl).toBe(true);
    expect(control.rate).toBeNull();
    expect(control.alerts).toBe(2);
    expect(stats.controlAlerts).toBe(2);
    expect(stats.rate).toBe(100);
  });

  it("ignore une autre version, un autre questionnaire, un choix hors échelle et une question inconnue", () => {
    const stats = computeTemplateStats(PERSONNE, [
      // « Une autre version » se calcule : une version figée finit par devenir la
      // version courante, et le test cesse alors de tester ce qu'il annonce.
      response("PERSONNE", { "p01-respect": "PAS" }, {}, PERSONNE.version + 1),
      response("FAMILLE", { "p01-respect": "PAS" }),
      response("PERSONNE", { "p01-respect": "PLUTOT", "inconnue": "TRES" }),
    ]);
    expect(stats.responses).toBe(1);
    expect(stats.questions.find((q) => q.questionId === "p01-respect")?.answered).toBe(0);
  });

  it("sépare les propositions sur le règlement des autres textes, sans auteur", () => {
    const stats = computeTemplateStats(PERSONNE, [
      response("PERSONNE", {}, { "p08b-regle-proposee": "  Prévenir la veille  ", "p13-message": "Merci" }),
      response("PERSONNE", {}, { "p13-message": "   " }),
    ]);
    expect(stats.ruleProposals).toEqual(["Prévenir la veille"]);
    expect(stats.verbatims).toEqual(["Merci"]);
  });

  it("withoutFreeTexts retire idées et propositions, garde les chiffres", () => {
    const stats = computeTemplateStats(PERSONNE, [
      response("PERSONNE", { "p01-respect": "TRES" }, { "p08b-regle-proposee": "Prévenir la veille", "p13-message": "Merci Mme X" }),
    ]);
    const stripped = withoutFreeTexts(stats);
    expect(stripped.verbatims).toEqual([]);
    expect(stripped.ruleProposals).toEqual([]);
    expect(stripped.questions).toEqual(stats.questions);
    expect(stripped.rate).toBe(stats.rate);
    expect(JSON.stringify(stripped)).not.toMatch(/Merci|veille/);
  });
});

describe("proposeSurveyActions", () => {
  const stats = [
    computeTemplateStats(PERSONNE, [
      response("PERSONNE", { "p03-prevenu": "PAS", "p01-respect": "TRES", "p11-personne-a-prevenir": "PAS" }),
      response("PERSONNE", { "p03-prevenu": "PEU", "p01-respect": "TRES" }),
    ]),
  ];

  it("propose une action par question sous 75 % et une mise à jour des dossiers", () => {
    const proposals = proposeSurveyActions(stats);
    expect(proposals.map((p) => p.key)).toEqual(["PERSONNE:p03-prevenu", "PERSONNE:controle"]);
    expect(proposals[0]!.title).toContain("Prévenu(e)");
    expect(proposals[0]!.reason).toContain("25 %");
  });

  it("n'écrit que les clés demandées, encore proposées et pas déjà au plan", () => {
    const proposals = proposeSurveyActions(stats);
    const selected = selectSurveyActionsToCreate(
      proposals,
      ["PERSONNE:p03-prevenu", "PERSONNE:controle", "FORGEE:x"],
      [proposals[1]!.title]
    );
    expect(selected.map((p) => p.key)).toEqual(["PERSONNE:p03-prevenu"]);
  });

  it("ne propose rien sans réponse", () => {
    expect(proposeSurveyActions([computeTemplateStats(FAMILLE, [])])).toEqual([]);
  });
});

describe("buildSurveyCsv", () => {
  it("agrège par question, sans aucune ligne par répondant, et neutralise les formules", () => {
    const csv = buildSurveyCsv([
      computeTemplateStats(PERSONNE, [response("PERSONNE", { "p01-respect": "TRES" }, { "p13-message": "=HACK()" })]),
    ]);
    expect(csv.startsWith("﻿Questionnaire;Question")).toBe(true);
    expect(csv).toContain("Gentillesse et respect des intervenants;1;1;100;Excellent;");
    expect(csv).toContain("Taux global");
    expect(csv).not.toContain("HACK");
    expect(csvCell("=SOMME(A1)")).toBe("'=SOMME(A1)");
    expect(csvCell('dit "oui"; non')).toBe('"dit ""oui""; non"');
    expect(csvCell(null)).toBe("");
    // En-tête + une ligne par question cotée (27 dans la version du 21/10) + taux global + fin.
    expect(csv.split("\r\n").length).toBe(1 + 27 + 1 + 1);
  });
});
