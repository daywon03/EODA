import { describe, expect, it } from "vitest";
import { normalizeFindings, normalizeCriteriaCoverage } from "./llm-analysis-port";

describe("normalizeFindings", () => {
  it("garde un élément bien formé {text, source}", () => {
    expect(normalizeFindings([{ text: "Objet du séjour", source: "Le présent séjour a pour objet…" }])).toEqual([
      { text: "Objet du séjour", source: "Le présent séjour a pour objet…" },
    ]);
  });

  it("accepte une chaîne nue (analyses stockées avant la citation source) sans source", () => {
    expect(normalizeFindings(["Objet du séjour"])).toEqual([{ text: "Objet du séjour", source: "" }]);
  });

  it("rejette ce qui n'est ni une chaîne ni un objet {text}", () => {
    expect(normalizeFindings([42, null, { a: 1 }, "", { text: "" }])).toEqual([]);
  });

  it("rend un tableau vide sur une valeur qui n'est pas un tableau", () => {
    expect(normalizeFindings(undefined)).toEqual([]);
    expect(normalizeFindings("pas un tableau")).toEqual([]);
    expect(normalizeFindings(null)).toEqual([]);
  });

  it("tolère une source manquante sur un objet {text} (modèle qui n'a pas respecté la consigne)", () => {
    expect(normalizeFindings([{ text: "Objet du séjour" }])).toEqual([{ text: "Objet du séjour", source: "" }]);
  });
});

describe("normalizeCriteriaCoverage", () => {
  it("garde une entrée bien formée", () => {
    expect(
      normalizeCriteriaCoverage([
        {
          criterionCode: "2.2.7",
          criterionLabel: "Le projet de service formalise...",
          status: "partiel",
          note: "La trame existe mais les modalités de révision ne sont pas décrites.",
        },
      ])
    ).toEqual([
      {
        criterionCode: "2.2.7",
        criterionLabel: "Le projet de service formalise...",
        status: "partiel",
        note: "La trame existe mais les modalités de révision ne sont pas décrites.",
      },
    ]);
  });

  it("ignore une entrée avec un statut hors énumération", () => {
    expect(
      normalizeCriteriaCoverage([
        { criterionCode: "2.2.7", criterionLabel: "...", status: "conforme", note: "..." },
      ])
    ).toEqual([]);
  });

  it("ignore une entrée à laquelle il manque un champ", () => {
    expect(normalizeCriteriaCoverage([{ criterionCode: "2.2.7" }])).toEqual([]);
  });

  it("rend un tableau vide sur une valeur qui n'est pas un tableau (analyse stockée avant ce champ)", () => {
    expect(normalizeCriteriaCoverage(undefined)).toEqual([]);
    expect(normalizeCriteriaCoverage(null)).toEqual([]);
    expect(normalizeCriteriaCoverage("pas un tableau")).toEqual([]);
  });
});
