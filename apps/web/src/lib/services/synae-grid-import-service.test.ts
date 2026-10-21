import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  describeSynaeImport,
  extractSynaeRows,
  parseSynaeRating,
  planSynaeImport,
  synaeGridChapter,
  type SynaeElementFacts,
  type SynaeRow,
} from "./synae-grid-import-service";
import { readFirstSheetAsText } from "./synae-workbook-reader";

// Grille fictive, même disposition que l'export Synaé : deux lignes de titre, puis
// l'en-tête (« Critère ID » en colonne O), puis critères et éléments d'évaluation.
function gridLine(cells: Partial<Record<number, string>>): string[] {
  return Array.from({ length: 16 }, (_, i) => cells[i] ?? "");
}
const HEADER = gridLine({ 0: "Chapitre", 5: "Cotation (E.E. uniquement)", 10: "Is Question?", 14: "Critère ID", 15: "ID Question" });
const SHEET = [
  gridLine({ 0: "Grille fictive" }),
  gridLine({}),
  HEADER,
  gridLine({ 3: "1.1.1", 4: "Critère fictif", 10: "false", 11: "1", 14: "1.1.1" }),
  gridLine({ 4: "Élément A", 5: "3", 7: "Livret d'accueil", 9: "À compléter", 10: "true", 11: "1", 14: "1.1.1", 15: "q-a" }),
  gridLine({ 4: "Élément B", 5: "", 10: "true", 11: "1", 14: "1.1.1", 15: "q-b" }),
  gridLine({ 4: "Élément C", 5: "RI", 10: "TRUE", 11: "1", 14: "1.1.2", 15: "q-c" }),
];

describe("extractSynaeRows", () => {
  it("cherche l'en-tête, ne garde que les éléments d'évaluation, compose le commentaire", () => {
    const rows = extractSynaeRows(SHEET);
    expect(rows?.map((r) => r.questionId)).toEqual(["q-a", "q-b", "q-c"]);
    expect(rows?.[0]).toMatchObject({
      criterionCode: "1.1.1",
      chapterNumber: 1,
      rawRating: "3",
      comment: "Preuves consultées : Livret d'accueil\nCommentaire : À compléter",
    });
    expect(rows?.[1]?.comment).toBeNull();
  });

  it("une feuille sans en-tête Synaé n'est pas une grille", () => {
    expect(extractSynaeRows([["a", "b"], ["c"]])).toBeNull();
  });
});

describe("parseSynaeRating", () => {
  it("lit l'échelle HAS, et seulement elle", () => {
    expect(parseSynaeRating("1")).toBe("R1");
    expect(parseSynaeRating(" 4 ")).toBe("R4");
    expect(parseSynaeRating("★")).toBe("STAR");
    expect(parseSynaeRating("4*")).toBe("STAR");
    expect(parseSynaeRating("NC")).toBe("NC");
    expect(parseSynaeRating("Non concerné")).toBe("NC");
    expect(parseSynaeRating("ri")).toBe("RI");
    expect(parseSynaeRating("")).toBeNull();
    // Jamais de système A/B/C/D, jamais une valeur devinée.
    expect(parseSynaeRating("B")).toBe("INVALID");
    expect(parseSynaeRating("5")).toBe("INVALID");
  });
});

describe("planSynaeImport", () => {
  const row = (questionId: string, rawRating: string, criterionCode = "2.2.2"): SynaeRow => ({
    questionId,
    criterionCode,
    chapterNumber: 2,
    rawRating,
    comment: null,
  });
  const facts = (elementId: string, over: Partial<SynaeElementFacts> = {}): SynaeElementFacts => ({
    elementId,
    requirementLevel: "STANDARD",
    inScope: true,
    ...over,
  });

  it("écrit ce qui est lisible, permis et pas encore coté — et compte tout le reste", () => {
    const plan = planSynaeImport(
      [
        row("q1", "3"),
        row("q2", ""),
        row("q3", "NC"),
        row("q4", "RI"),
        row("q5", "2"),
        row("q6", "4"),
        row("q-inconnue", "1"),
        row("q7", "Z"),
      ],
      {
        chapterNumber: 2,
        elements: new Map([
          ["q1", facts("e1")],
          ["q2", facts("e2")],
          ["q3", facts("e3", { requirementLevel: "IMPERATIF" })],
          ["q4", facts("e4")],
          ["q5", facts("e5")],
          ["q6", facts("e6", { inScope: false })],
          ["q7", facts("e7")],
        ]),
        ratedElementIds: new Set(["e5"]),
      }
    );
    expect(plan.toWrite).toEqual([{ elementId: "e1", rating: "R3", comment: null }]);
    expect(plan.empty).toBe(1);
    expect(plan.alreadyRated).toBe(1);
    expect(plan.outOfScope).toBe(1);
    expect(plan.unknownQuestion).toBe(1);
    // NC sur impératif, RI hors chapitre 1, cotation illisible.
    expect(plan.refused.map((r) => r.reason)).toEqual([
      expect.stringContaining("NC"),
      expect.stringContaining("Chapitre 1"),
      expect.stringContaining("« Z »"),
    ]);
    expect(describeSynaeImport(plan)).toContain("1 cotation(s) importée(s)");
  });

  it("une même question citée deux fois n'est écrite qu'une fois", () => {
    const plan = planSynaeImport([row("q1", "3"), row("q1", "4")], {
      chapterNumber: 2,
      elements: new Map([["q1", facts("e1")]]),
      ratedElementIds: new Set(),
    });
    expect(plan.toWrite).toHaveLength(1);
  });
});

describe("synaeGridChapter", () => {
  it("un seul chapitre, sinon aucun", () => {
    const rows = extractSynaeRows(SHEET) ?? [];
    expect(synaeGridChapter(rows)).toBe(1);
    expect(synaeGridChapter([...rows, { ...rows[0]!, chapterNumber: 2 }])).toBeNull();
    expect(synaeGridChapter([])).toBeNull();
  });
});

describe("readFirstSheetAsText", () => {
  it("relit un vrai classeur .xlsx, colonne A à l'index 0", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Grille d'évaluation Synaé");
    for (const line of SHEET) sheet.addRow(line);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const text = await readFirstSheetAsText(buffer);
    const rows = text ? extractSynaeRows(text) : null;
    expect(rows?.map((r) => [r.questionId, r.rawRating])).toEqual([
      ["q-a", "3"],
      ["q-b", ""],
      ["q-c", "RI"],
    ]);
  });

  it("un contenu illisible rend null, sans exception", async () => {
    expect(await readFirstSheetAsText(Buffer.from("pas un classeur"))).toBeNull();
  });
});
