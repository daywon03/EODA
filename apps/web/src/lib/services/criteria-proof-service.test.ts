import { describe, expect, it } from "vitest";
import {
  PROOF_PILLS,
  buildCriteriaProofRows,
  compareCriterionCodes,
  countImperativesProven,
  deriveCriterionProof,
  describeImperativesProof,
  filterProofRows,
  isDocumentProven,
  parseProofFilter,
  type ProofDocumentFacts,
} from "./criteria-proof-service";
import {
  EXPECTED_IMPERATIVE_COUNT,
  applicableToValuesFor,
  isCriterionApplicable,
} from "./criterion-applicability-service";
import { describeImperativesMeasure } from "./structure-sheet-service";

const D = (day: number): Date => new Date(2026, 9, day);

function doc(id: string, facts: Partial<ProofDocumentFacts> = {}): ProofDocumentFacts {
  return { documentTypeId: id, versionUploadedAt: D(1), validatedAt: null, clientAcceptedAt: null, ...facts };
}

describe("isDocumentProven — jamais sans relecture ni acceptation", () => {
  it("accompagné : relu par EODA APRÈS le dépôt de la version courante", () => {
    expect(isDocumentProven(doc("t", { validatedAt: D(2) }), "ACCOMPAGNE")).toBe(true);
    expect(isDocumentProven(doc("t", { validatedAt: D(1) }), "ACCOMPAGNE")).toBe(true);
    // Validation d'une version antérieure : une nouvelle version la rend caduque.
    expect(isDocumentProven(doc("t", { versionUploadedAt: D(5), validatedAt: D(2) }), "ACCOMPAGNE")).toBe(false);
    // L'acceptation de la structure ne vaut pas relecture EODA en accompagné.
    expect(isDocumentProven(doc("t", { clientAcceptedAt: D(3) }), "ACCOMPAGNE")).toBe(false);
  });

  it("autonomie : acceptation de la structure encore valable", () => {
    expect(isDocumentProven(doc("t", { clientAcceptedAt: D(3) }), "AUTONOMIE")).toBe(true);
    expect(isDocumentProven(doc("t", { versionUploadedAt: D(5), clientAcceptedAt: D(3) }), "AUTONOMIE")).toBe(false);
    expect(isDocumentProven(doc("t", { validatedAt: D(3) }), "AUTONOMIE")).toBe(false);
  });

  it("aucune version : jamais prouvé", () => {
    expect(isDocumentProven(doc("t", { versionUploadedAt: null, validatedAt: D(3) }), "ACCOMPAGNE")).toBe(false);
  });
});

describe("deriveCriterionProof", () => {
  const docs = new Map([
    ["a", doc("a", { validatedAt: D(2) })],
    ["b", doc("b")],
    ["c", doc("c", { versionUploadedAt: null })],
  ]);

  it("Prouvé : tous les types attendus prouvés", () => {
    expect(deriveCriterionProof(["a", "a"], docs, "ACCOMPAGNE")).toEqual({ status: "PROUVE", expected: 1, deposited: 1, proven: 1 });
  });

  it("En partie : au moins un déposé, pas tous prouvés", () => {
    expect(deriveCriterionProof(["a", "b"], docs, "ACCOMPAGNE").status).toBe("EN_PARTIE");
    expect(deriveCriterionProof(["b", "c"], docs, "ACCOMPAGNE").status).toBe("EN_PARTIE");
  });

  it("Sans preuve : aucun type attendu déposé (document absent ou sans version)", () => {
    expect(deriveCriterionProof(["c", "z"], docs, "ACCOMPAGNE").status).toBe("SANS_PREUVE");
  });

  it("Non rattaché : la matrice ne relie aucun document", () => {
    expect(deriveCriterionProof([], docs, "ACCOMPAGNE").status).toBe("NON_RATTACHE");
  });
});

describe("lignes, filtres et décompte des impératifs", () => {
  const rows = buildCriteriaProofRows(
    [
      { id: "2", code: "1.10.1", label: "B", chapterNumber: 1, isImperative: false, expectedDocumentTypeIds: ["a"] },
      { id: "1", code: "1.2.1", label: "A", chapterNumber: 1, isImperative: true, expectedDocumentTypeIds: ["a"] },
      { id: "3", code: "3.11.1", label: "C", chapterNumber: 3, isImperative: true, expectedDocumentTypeIds: ["b"] },
    ],
    [doc("a", { clientAcceptedAt: D(2) }), doc("b")],
    "AUTONOMIE"
  );

  it("trie les codes nombre à nombre", () => {
    expect(rows.map((r) => r.code)).toEqual(["1.2.1", "1.10.1", "3.11.1"]);
    expect(compareCriterionCodes("1.2", "1.2.0")).toBe(0);
  });

  it("compte les impératifs prouvés", () => {
    expect(countImperativesProven(rows)).toEqual({ proven: 1, total: 2 });
    expect(describeImperativesProof({ proven: 1, total: 2 })).toBe("1 / 2");
  });

  it("filtre les impératifs ; une valeur inconnue vaut « tous »", () => {
    expect(filterProofRows(rows, parseProofFilter("IMPERATIFS"))).toHaveLength(2);
    expect(filterProofRows(rows, parseProofFilter("n'importe quoi"))).toHaveLength(3);
    expect(parseProofFilter(undefined)).toBe("TOUS");
  });

  it("chaque état a une pastille glyphe + mot, jamais « conforme »", () => {
    for (const pill of Object.values(PROOF_PILLS)) {
      expect(pill.glyph).not.toBe("");
      expect(pill.label).not.toMatch(/conforme|validé/i);
    }
  });
});

describe("profil SAD aide / SAD mixte", () => {
  it("un SAD aide ne voit jamais un critère réservé au SAD mixte", () => {
    expect(isCriterionApplicable("SAD_MIXTE", "SAD_AIDE")).toBe(false);
    expect(isCriterionApplicable("SAD_MIXTE", "SAD_MIXTE")).toBe(true);
    expect(isCriterionApplicable("BOTH", "SAD_AIDE")).toBe(true);
    expect(applicableToValuesFor("SAD_MIXTE")).toEqual(["BOTH", "SAD_MIXTE"]);
    expect(EXPECTED_IMPERATIVE_COUNT).toEqual({ SAD_AIDE: 16, SAD_MIXTE: 17 });
  });

  it("cadre de la vue d'ensemble : x / total, repère cité seulement s'il diffère", () => {
    expect(describeImperativesMeasure({ proven: 4, total: 16 }, 16)).toMatchObject({ value: "4 / 16", percent: 25 });
    expect(describeImperativesMeasure({ proven: 0, total: 0 }, 17)).toMatchObject({ percent: 0 });
    expect(describeImperativesMeasure({ proven: 0, total: 16 }, 17).note).toContain("17");
  });
});
