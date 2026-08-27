import { describe, expect, it } from "vitest";
import {
  buildReportFileName,
  buildReportLine,
  buildReportLines,
  hasReportableContent,
  summariseReport,
  type ReportSourceItem,
} from "./conformity-report-service";

const ANALYSIS = {
  elementsPresents: ["Objet du séjour"],
  elementsManquants: ["Mention des voies de recours", "Date de révision"],
  suggestionsCorrection: ["Ajouter un paragraphe sur la personne qualifiée."],
  sembleConforme: false,
};

function item(overrides: Partial<ReportSourceItem> = {}): ReportSourceItem {
  return {
    code: "L2002_DIPC",
    label: "DIPC / Contrat de séjour",
    category: "LOI_2002_2",
    step: "RESTITUE",
    analysis: ANALYSIS,
    analysisReviewedAt: new Date("2026-09-01"),
    criteria: [{ code: "1.10.6", label: "Le projet personnalisé est réactualisé" }],
    ...overrides,
  };
}

describe("buildReportLine", () => {
  it("rend le contenu de l'analyse une fois relue", () => {
    const line = buildReportLine(item());

    expect(line.state).toBe("ANALYSE");
    expect(line.missing).toHaveLength(2);
    expect(line.suggestions).toHaveLength(1);
    expect(line.criteria[0]?.code).toBe("1.10.6");
  });

  it("annonce l'attente SANS publier l'analyse non relue", () => {
    // Le rapport part chez le client : y verser une analyse que personne n'a vérifiée
    // contournerait la revue humaine par la porte de l'imprimante.
    const line = buildReportLine(item({ analysisReviewedAt: null }));

    expect(line.state).toBe("EN_RELECTURE");
    expect(line.missing).toEqual([]);
    expect(line.suggestions).toEqual([]);
    expect(line.present).toEqual([]);
  });

  it("signale un document jamais déposé", () => {
    // C'est une information à part entière — la première ligne du plan d'action.
    const line = buildReportLine(item({ step: "ATTENDU", analysis: null, analysisReviewedAt: null }));
    expect(line.state).toBe("MANQUANT");
  });

  it("traite comme manquant un document sans analyse, même marqué déposé", () => {
    const line = buildReportLine(item({ step: "DEPOSE", analysis: null }));
    expect(line.state).toBe("MANQUANT");
  });
});

describe("summariseReport", () => {
  it("compte les documents par état et le total des écarts", () => {
    const lines = buildReportLines([
      item(),
      item({ code: "A", analysisReviewedAt: null }),
      item({ code: "B", step: "ATTENDU", analysis: null }),
    ]);

    expect(summariseReport(lines)).toEqual({
      total: 3,
      missingDocuments: 1,
      awaitingReview: 1,
      analysed: 1,
      gaps: 2,
    });
  });
});

describe("hasReportableContent", () => {
  it("refuse un rapport où tout attend encore la relecture", () => {
    // Mieux vaut ne pas produire que remettre un document vide à l'en-tête d'EODA.
    const lines = buildReportLines([item({ analysisReviewedAt: null })]);
    expect(hasReportableContent(lines)).toBe(false);
  });

  it("accepte un rapport qui n'a que des manques à annoncer", () => {
    const lines = buildReportLines([item({ step: "ATTENDU", analysis: null })]);
    expect(hasReportableContent(lines)).toBe(true);
  });
});

describe("buildReportFileName", () => {
  it("suit la convention EODA", () => {
    expect(
      buildReportFileName({ structureName: "ASSAD Benoit", issuedOn: new Date(2026, 8, 3) })
    ).toBe("20260903_RAPPORT_ASSAD-Benoit_Mise-en-conformite-documentaire_v01_Externe.pdf");
  });
});
