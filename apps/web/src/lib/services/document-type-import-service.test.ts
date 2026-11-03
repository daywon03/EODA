import { describe, expect, it } from "vitest";
import {
  criterionCodesInText,
  detectCsvDelimiter,
  ImportFormatError,
  parseImportPayload,
  planDocumentTypeImport,
  readImportRows,
} from "./document-type-import-service";

// Forme de l'onglet « récapitulatif » montré au call du 29/10/2026 : une ligne de
// titre, puis l'en-tête, puis une fiche par ligne avec ses critères (impératifs et
// standards en deux colonnes, séparés par des points-virgules).
const RECAP = [
  ["Récapitulatif des fiches de sensibilisation", "", "", ""],
  ["N°", "Intitulé de la fiche", "Critères impératifs", "Autres critères", "Remarque v02"],
  ["1", "Gestion des plaintes", "3.12.1 ; 3.12.2", "1.2.5;3-12-3", "Corrigée le 29/10"],
  ["2", "  Bientraitance   au quotidien ", "", "3.1.3 ; 3.11.3", ""],
  ["", "", "", "", ""],
  ["3", "Exercice de crise", "3.14.2", "", ""],
];

describe("readImportRows", () => {
  it("trouve l'en-tête sous une ligne de titre et lit toutes les colonnes « critère »", () => {
    expect(readImportRows(RECAP)).toEqual([
      { label: "Gestion des plaintes", criteria: ["3.12.1", "3.12.2", "1.2.5", "3.12.3"], folderLabel: null },
      { label: "Bientraitance au quotidien", criteria: ["3.1.3", "3.11.3"], folderLabel: null },
      { label: "Exercice de crise", criteria: ["3.14.2"], folderLabel: null },
    ]);
  });

  it("lit une colonne « Dossier » si elle existe", () => {
    const rows = readImportRows([
      ["Titre", "Dossier"],
      ["Note médicaments", "Notes de service"],
    ]);
    expect(rows).toEqual([{ label: "Note médicaments", criteria: [], folderLabel: "Notes de service" }]);
  });

  it("refuse un fichier sans colonne d'intitulé, en le disant", () => {
    expect(() => readImportRows([["a", "b"], ["c", "d"]])).toThrow(ImportFormatError);
  });
});

describe("criterionCodesInText", () => {
  it("ne prend ni une version ni une date pour un critère", () => {
    expect(criterionCodesInText("v02 du 29/10/2026, voir 2.2.7 et 1.2")).toEqual(["2.2.7", "1.2"]);
  });
});

describe("planDocumentTypeImport", () => {
  const known = new Set(["3.12.1", "3.14.2"]);
  const plan = (rows: { label: string; criteria: string[] }[]) =>
    planDocumentTypeImport({
      rows,
      existingLabels: ["Note de service"],
      knownCriterionCodes: known,
      labelError: (label) => (label.length < 3 ? "trop court" : null),
    });

  it("propose les lignes neuves et nomme ce qui bloque les autres", () => {
    const result = plan([
      { label: "Gestion des plaintes", criteria: ["3.12.1"] },
      { label: "note DE service", criteria: [] },
      { label: "Gestion des plaintes", criteria: [] },
      { label: "Crise", criteria: ["3.14.2", "9.9.9"] },
      { label: "ab", criteria: [] },
    ]);
    expect(result.map((line) => [line.status, line.problem])).toEqual([
      ["NEW", null],
      ["DUPLICATE", "Existe déjà : « Note de service »."],
      ["DUPLICATE", "En double dans le fichier."],
      ["INVALID", "Critère inconnu du référentiel : 9.9.9."],
      ["INVALID", "trop court"],
    ]);
  });
});

describe("parseImportPayload", () => {
  it("accepte la forme attendue, refuse le reste", () => {
    expect(parseImportPayload([{ label: "A", criteria: ["1.2"] }])).toEqual([{ label: "A", criteria: ["1.2"] }]);
    expect(parseImportPayload([])).toBeNull();
    expect(parseImportPayload("x")).toBeNull();
    expect(parseImportPayload([{ label: 3, criteria: [] }])).toBeNull();
    expect(parseImportPayload([{ label: "A", criteria: [4] }])).toBeNull();
    expect(parseImportPayload(Array.from({ length: 201 }, () => ({ label: "A", criteria: [] })))).toBeNull();
  });
});

describe("detectCsvDelimiter", () => {
  it("reconnaît l'export d'Excel en français", () => {
    expect(detectCsvDelimiter("\nIntitulé;Critères\nA;3.1.3, 3.11.3")).toBe(";");
    expect(detectCsvDelimiter("Intitulé,Critères")).toBe(",");
  });
});
