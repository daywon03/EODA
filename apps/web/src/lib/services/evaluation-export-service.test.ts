import { describe, expect, it } from "vitest";
import {
  buildEvaluationCsv,
  buildEvaluationCsvLine,
  buildEvaluationExportFileName,
  escapeCsvValue,
  summariseExport,
  type EvaluationExportRow,
} from "./evaluation-export-service";

function row(overrides: Partial<EvaluationExportRow> = {}): EvaluationExportRow {
  return {
    chapterNumber: 2,
    chapterName: "Chapitre 2",
    themeCode: "2.1",
    themeName: "Thématique",
    objectiveCode: "2.1.1",
    criterionCode: "2.1.1.1",
    criterionLabel: "Libellé du critère",
    requirementLevel: "STANDARD",
    criterionScore: null,
    elementText: "Élément d'évaluation",
    rating: null,
    comment: null,
    suggestedBySystem: false,
    ...overrides,
  };
}

describe("escapeCsvValue", () => {
  it("laisse une valeur simple intacte", () => {
    expect(escapeCsvValue("Direction")).toBe("Direction");
  });

  it("protège le séparateur, les guillemets et les sauts de ligne", () => {
    expect(escapeCsvValue("a;b")).toBe('"a;b"');
    expect(escapeCsvValue('il a dit "oui"')).toBe('"il a dit ""oui"""');
    expect(escapeCsvValue("ligne1\nligne2")).toBe('"ligne1\nligne2"');
  });
});

describe("buildEvaluationCsvLine", () => {
  it("traduit la cotation en libellé HAS et en valeur numérique", () => {
    const line = buildEvaluationCsvLine(row({ rating: "R3", criterionScore: 3 }));
    expect(line).toContain("3;3;");
    expect(line).toContain("3,00");
  });

  it("cote ★ à 4 — c'est la règle HAS, pas une valeur à part", () => {
    expect(buildEvaluationCsvLine(row({ rating: "STAR" }))).toContain("★;4;");
  });

  // Le piège : une cellule vide et un zéro ne se lisent pas pareil dans un tableur.
  it("laisse la cotation VIDE quand rien n'a été coté, jamais 0", () => {
    const line = buildEvaluationCsvLine(row({ rating: null }));
    expect(line).toContain("Élément d'évaluation;;;");
    expect(line).not.toContain(";0;");
  });

  it("laisse NC et RI sans valeur numérique — ils sortent du calcul de moyenne", () => {
    expect(buildEvaluationCsvLine(row({ rating: "NC" }))).toContain("NC;;");
    expect(buildEvaluationCsvLine(row({ rating: "RI" }))).toContain("RI;;");
  });

  it("dit l'origine d'une cotation suggérée puis confirmée", () => {
    expect(buildEvaluationCsvLine(row({ rating: "R4", suggestedBySystem: true }))).toContain(
      "Suggérée puis confirmée"
    );
  });

  it("distingue impératif et standard en clair", () => {
    expect(buildEvaluationCsvLine(row({ requirementLevel: "IMPERATIF" }))).toContain("Impératif");
  });

  it("protège un commentaire qui contient un point-virgule", () => {
    const line = buildEvaluationCsvLine(row({ comment: "revoir ; à compléter" }));
    expect(line).toContain('"revoir ; à compléter"');
  });
});

describe("buildEvaluationCsv", () => {
  it("porte le BOM UTF-8, sans quoi Excel casse les accents", () => {
    expect(buildEvaluationCsv([])).toMatch(/^﻿/);
  });

  it("écrit l'en-tête même sans aucune ligne — un export vide reste lisible", () => {
    const csv = buildEvaluationCsv([]);
    expect(csv).toContain("Chapitre;Nom du chapitre;");
    expect(csv.trimEnd().split("\r\n")).toHaveLength(1);
  });

  it("termine ses lignes en CRLF", () => {
    const csv = buildEvaluationCsv([row()]);
    expect(csv.split("\r\n")).toHaveLength(3); // en-tête, ligne, fin
  });
});

describe("buildEvaluationExportFileName", () => {
  it("suit la convention EODA, en Interne", () => {
    expect(
      buildEvaluationExportFileName({
        structureName: "Structure test",
        issuedOn: new Date("2026-09-01T08:00:00Z"),
      })
    ).toBe("20260901_EXPORT_Structure-test_Cotations-HAS_v01_Interne.csv");
  });
});

describe("summariseExport", () => {
  it("compte les éléments et ceux réellement cotés", () => {
    const summary = summariseExport([row({ rating: "R3" }), row(), row({ rating: "NC" })]);
    expect(summary).toMatchObject({ elements: 3, rated: 2 });
  });

  it("compte un critère impératif à risque une seule fois, même sur plusieurs éléments", () => {
    const atRisk = { requirementLevel: "IMPERATIF" as const, criterionScore: 2 };
    const summary = summariseExport([
      row({ ...atRisk, criterionCode: "3.6.1" }),
      row({ ...atRisk, criterionCode: "3.6.1" }),
      row({ ...atRisk, criterionCode: "3.7.1" }),
    ]);
    expect(summary.imperatifsAtRisk).toBe(2);
  });

  it("ne compte pas comme à risque un impératif non coté", () => {
    expect(
      summariseExport([row({ requirementLevel: "IMPERATIF", criterionScore: null })]).imperatifsAtRisk
    ).toBe(0);
  });
});
