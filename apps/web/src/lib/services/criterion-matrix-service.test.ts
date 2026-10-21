import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE_SEEDS, PILOT_DOCUMENT_TYPES } from "@eoda/database/document-types";
import { PROPOSED_MATRIX_CSV } from "@/content/criteres/matrice-proposition";
import {
  buildMatrixView,
  describeMatrixDecision,
  pairKey,
  parseCsv,
  parseProposedMatrix,
  planFullProposalLoad,
  planMatrixDecision,
  promotionError,
  sanitizeRemark,
  type MatrixRow,
  type MatrixView,
  manualUnlinkError,
  planManualLinks,
} from "./criterion-matrix-service";

const SOURCE = path.resolve(__dirname, "../../../../../.claude/specs/data/20261008_proposition-document-type-criterion.csv");

describe("copie embarquée de la matrice proposée", () => {
  it("est identique à la source versionnée (règle zéro : pas de dérive silencieuse)", () => {
    expect(PROPOSED_MATRIX_CSV).toBe(readFileSync(SOURCE, "utf8").replace(/\r\n/g, "\n"));
  });

  it("se lit entièrement : 390 rattachements, 55 types, aucune remarque ne cite le sigle erroné", () => {
    const rows = parseProposedMatrix(PROPOSED_MATRIX_CSV);
    expect(rows).toHaveLength(390);
    expect(new Set(rows.map((r) => r.documentTypeCode)).size).toBe(55);
    const counts = { HAUTE: 0, MOYENNE: 0, BASSE: 0 };
    for (const r of rows) counts[r.confidence]++;
    expect(counts).toEqual({ HAUTE: 164, MOYENNE: 203, BASSE: 23 });
    const wrongAcronym = new RegExp(["DI", "PEC"].join(""), "i");
    expect(rows.some((r) => wrongAcronym.test(r.remark ?? ""))).toBe(false);
  });

  it("ne propose que des types du seed, sous leur libellé exact (aucun type « inconnu » à l'écran)", () => {
    const seedLabels = new Map(DOCUMENT_TYPE_SEEDS.map((t) => [t.code, t.label]));
    for (const row of parseProposedMatrix(PROPOSED_MATRIX_CSV)) {
      expect(seedLabels.get(row.documentTypeCode)).toBe(row.documentTypeLabel);
    }
  });

  it("propose au moins un critère pour chacun des 19 types du référentiel du pilote (14/10/2026)", () => {
    const proposed = new Set(parseProposedMatrix(PROPOSED_MATRIX_CSV).map((r) => r.documentTypeCode));
    expect(PILOT_DOCUMENT_TYPES.filter((t) => !proposed.has(t.code))).toEqual([]);
  });

  it("laisse 12 types du seed sans aucune proposition — aucun n'est un type du pilote", () => {
    // Mesuré le 15/10/2026 : ces types sont muets, donc indécidables depuis l'écran
    // « Matrice » — c'est cette liste que la page affiche pour qu'ils ne disparaissent
    // pas en silence. Le chiffre vit ici : le commentaire d'en-tête a déjà dérivé une fois.
    const rows = parseProposedMatrix(PROPOSED_MATRIX_CSV);
    const seedLabels = new Map(DOCUMENT_TYPE_SEEDS.map((t) => [t.code, t.label]));
    // Les intitulés de critères vivent dans le référentiel en base, hors de ces règles
    // pures : ici ils ne servent qu'à rendre les critères cités applicables.
    const criterionLabels = new Map([...new Set(rows.map((r) => r.criterionCode))].map((c) => [c, c]));
    const view = buildMatrixView(rows, {
      criterionLabels,
      documentTypeLabels: seedLabels,
      linkedPairs: new Set<string>(),
    });
    expect(view.typesWithoutProposal.map((t) => t.code)).toEqual([
      "FONCT_CPOM",
      "FONCT_CR_COMMISSIONS",
      "FONCT_ORGANIGRAMME",
      "FONCT_PLANNING_ANIMATION",
      "FONCT_PLAQUETTE",
      "FONCT_RAPPORTS_ACTIVITE",
      "L2002_PERSONNES_QUALIFIEES",
      "P12_BILAN_ANNUEL",
      "P13_SIGNALEMENT_ARS",
      "P14_DATE_REVISION",
      "P14_PREUVE_SIMULATION",
      // 20/10/2026 : PLAC entre au catalogue (context/11 §6.2) mais la feuille de suivi
      // du pilote ne porte pas de ligne « PLAC » — aucune proposition ne s'invente.
      "QUALITE_PLAC",
    ]);
    const pilotCodes = new Set(PILOT_DOCUMENT_TYPES.map((t) => t.code));
    expect(view.typesWithoutProposal.filter((t) => pilotCodes.has(t.code))).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("gère les guillemets, les virgules et les guillemets doublés", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\nf,g,h\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["f", "g", "h"],
    ]);
  });

  it("ignore les lignes vides et lit une dernière ligne sans saut", () => {
    expect(parseCsv("a,b\n\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("parseProposedMatrix", () => {
  const header = "document_type_code,document_type_label,criterion_code,source_libelle_xlsx,confiance,remarque";

  it("refuse un en-tête inattendu", () => {
    expect(() => parseProposedMatrix("x,y\n")).toThrow("en-tête");
  });

  it("écarte les lignes mal formées au lieu de les deviner", () => {
    const rows = parseProposedMatrix(
      [header, "T,Type,1.1.1,src,HAUTE,", "T,Type,pas-un-code,src,HAUTE,", "T,Type,1.1.2,src,PEUT-ETRE,", ",Type,1.1.3,src,BASSE,"].join("\n")
    );
    expect(rows.map((r) => r.criterionCode)).toEqual(["1.1.1"]);
    expect(rows[0]?.remark).toBeNull();
  });
});

describe("sanitizeRemark", () => {
  it("retire la mention de provenance du sigle et garde le reste", () => {
    expect(sanitizeRemark("le xlsx écrit « XX » ; à confirmer critère par critère")).toBe("à confirmer critère par critère");
    expect(sanitizeRemark("le xlsx écrit « XX »")).toBeNull();
    expect(sanitizeRemark("")).toBeNull();
  });
});

const ROWS: MatrixRow[] = [
  { documentTypeCode: "L2002_DIPC", documentTypeLabel: "DIPC", criterionCode: "1.10.2", confidence: "MOYENNE", remark: null },
  { documentTypeCode: "L2002_DIPC", documentTypeLabel: "DIPC", criterionCode: "1.2.1", confidence: "HAUTE", remark: null },
  { documentTypeCode: "L2002_DIPC", documentTypeLabel: "DIPC", criterionCode: "1.2.1", confidence: "HAUTE", remark: null },
  { documentTypeCode: "L2002_DIPC", documentTypeLabel: "DIPC", criterionCode: "1.4.2", confidence: "HAUTE", remark: null },
  { documentTypeCode: "INCONNU", documentTypeLabel: "?", criterionCode: "1.1.1", confidence: "BASSE", remark: null },
  { documentTypeCode: "A_TYPE", documentTypeLabel: "A", criterionCode: "3.1.1", confidence: "HAUTE", remark: null },
];

describe("buildMatrixView", () => {
  const view = buildMatrixView(ROWS, {
    criterionLabels: new Map([
      ["1.10.2", "Intitulé 1.10.2"],
      ["1.2.1", "La personne est informée de ses droits"],
      ["1.1.1", "Intitulé 1.1.1"],
      ["3.1.1", "Intitulé 3.1.1"],
    ]),
    documentTypeLabels: new Map([
      ["L2002_DIPC", "DIPC / Contrat de séjour"],
      ["A_TYPE", "Type A"],
    ]),
    linkedPairs: new Set([pairKey("L2002_DIPC", "1.2.1")]),
  });

  it("groupe par type (libellé de la base), trie les critères nombre à nombre, sans doublon", () => {
    expect(view.groups.map((g) => g.documentTypeCode)).toEqual(["A_TYPE", "L2002_DIPC"]);
    const dipc = view.groups[1];
    expect(dipc?.documentTypeLabel).toBe("DIPC / Contrat de séjour");
    expect(dipc?.rows.map((r) => [r.criterionCode, r.linked])).toEqual([
      ["1.2.1", true],
      ["1.10.2", false],
    ]);
  });

  it("porte l'intitulé du critère à côté de son code (un code seul ne se relit pas)", () => {
    const dipc = view.groups[1];
    expect(dipc?.rows[0]?.criterionLabel).toBe("La personne est informée de ses droits");
  });

  it("liste à part les critères absents du référentiel et les types inconnus — jamais écrits", () => {
    expect(view.notApplicable).toEqual([{ criterionCode: "1.4.2", documentTypeCodes: ["L2002_DIPC"] }]);
    expect(view.unknownDocumentTypes).toEqual(["INCONNU"]);
  });

  it("ne signale aucun type sans proposition quand tous les types connus sont cités", () => {
    expect(view.typesWithoutProposal).toEqual([]);
  });
});

describe("buildMatrixView — types de la base sans rattachement proposé", () => {
  const DOCUMENT_TYPE_LABELS = new Map([
    ["A_TYPE", "Type A"],
    ["B_TYPE", "Type B"],
    ["L2002_DIPC", "DIPC / Contrat de séjour"],
  ]);

  function viewOf(rows: MatrixRow[], criterionLabels: [string, string][]): MatrixView {
    return buildMatrixView(rows, {
      criterionLabels: new Map(criterionLabels),
      documentTypeLabels: DOCUMENT_TYPE_LABELS,
      linkedPairs: new Set<string>(),
    });
  }

  const row = (documentTypeCode: string, criterionCode: string): MatrixRow => ({
    documentTypeCode,
    documentTypeLabel: "?",
    criterionCode,
    confidence: "HAUTE",
    remark: null,
  });

  const INTITULE: [string, string][] = [["1.2.1", "La personne est informée de ses droits"]];

  it("liste les types de la base qu'aucune ligne ne cite — triés par code, avec leur libellé", () => {
    const v = viewOf([row("L2002_DIPC", "1.2.1")], INTITULE);
    expect(v.typesWithoutProposal).toEqual([
      { code: "A_TYPE", label: "Type A" },
      { code: "B_TYPE", label: "Type B" },
    ]);
  });

  it("ne liste PAS un type cité dont les critères sont tous hors périmètre : cité n'est pas décidable", () => {
    // B_TYPE a bien une proposition — elle est seulement inexploitable en l'état, faute
    // de critères au référentiel. Le dire « sans proposition » serait faux.
    const v = viewOf([row("B_TYPE", "9.9.9")], INTITULE);
    expect(v.notApplicable).toEqual([{ criterionCode: "9.9.9", documentTypeCodes: ["B_TYPE"] }]);
    expect(v.groups).toEqual([]);
    expect(v.typesWithoutProposal).toEqual([
      { code: "A_TYPE", label: "Type A" },
      { code: "L2002_DIPC", label: "DIPC / Contrat de séjour" },
    ]);
  });

  it("ne compte pas deux fois un type inconnu de la base", () => {
    const v = viewOf([row("INCONNU", "1.2.1")], INTITULE);
    expect(v.unknownDocumentTypes).toEqual(["INCONNU"]);
    expect(v.typesWithoutProposal.map((t) => t.code)).toEqual(["A_TYPE", "B_TYPE", "L2002_DIPC"]);
  });

  it("trie les codes nombre à nombre (P2 avant P10), pas alphabétiquement", () => {
    const numbered = buildMatrixView([], {
      criterionLabels: new Map(INTITULE),
      documentTypeLabels: new Map([
        ["P10_X", "Type 10"],
        ["P2_X", "Type 2"],
      ]),
      linkedPairs: new Set<string>(),
    });
    expect(numbered.typesWithoutProposal.map((t) => t.code)).toEqual(["P2_X", "P10_X"]);
  });
});

describe("planMatrixDecision", () => {
  it("crée les cochés proposés, retire les proposés décochés déjà liés, ignore le reste", () => {
    const decision = planMatrixDecision({
      proposedCriterionCodes: ["1.1.1", "1.2.1", "1.3.1"],
      checkedCriterionCodes: ["1.1.1", "9.9.9", "1.1.1"],
      linkedCriterionCodes: new Set(["1.2.1", "2.2.2"]),
    });
    expect(decision).toEqual({ toCreate: ["1.1.1"], toDelete: ["1.2.1"], ignored: ["9.9.9"] });
    // « 2.2.2 » n'est pas proposé pour ce type : jamais retiré par cet écran.
    expect(describeMatrixDecision("T", decision)).toBe("T · +1 −1");
  });

  it("ne recrée pas un lien déjà posé", () => {
    expect(
      planMatrixDecision({
        proposedCriterionCodes: ["1.1.1"],
        checkedCriterionCodes: ["1.1.1"],
        linkedCriterionCodes: new Set(["1.1.1"]),
      })
    ).toEqual({ toCreate: [], toDelete: [], ignored: [] });
  });
});

describe("promotionError", () => {
  it("n'accepte qu'une suggestion confirmée, typée, pas encore liée", () => {
    expect(promotionError({ status: "CONFIRMED", documentTypeId: "t", alreadyLinked: false })).toBeNull();
    expect(promotionError({ status: "PENDING", documentTypeId: "t", alreadyLinked: false })).toContain("confirmée");
    expect(promotionError({ status: "REJECTED", documentTypeId: "t", alreadyLinked: false })).toContain("confirmée");
    expect(promotionError({ status: "CONFIRMED", documentTypeId: null, alreadyLinked: false })).toContain("type");
    expect(promotionError({ status: "CONFIRMED", documentTypeId: "t", alreadyLinked: true })).toContain("déjà");
  });
});

describe("planFullProposalLoad — charger toute la proposition", () => {
  const row = (documentTypeCode: string, criterionCode: string): MatrixRow => ({
    documentTypeCode,
    documentTypeLabel: documentTypeCode,
    criterionCode,
    confidence: "BASSE",
    remark: null,
  });

  it("ajoute chaque couple connu une seule fois, ignore le déjà rattaché et l'inconnu", () => {
    const plan = planFullProposalLoad(
      [row("DIPC", "1.2.1"), row("DIPC", "1.2.1"), row("DIPC", "1.4.2"), row("DIPC", "9.9.9"), row("INCONNU", "1.2.1")],
      {
        documentTypeIds: new Map([["DIPC", "t-dipc"]]),
        criterionIds: new Map([["1.2.1", "c-121"], ["1.4.2", "c-142"]]),
        linkedPairs: new Set([pairKey("DIPC", "1.4.2")]),
      }
    );
    expect(plan).toEqual({ toCreate: [{ documentTypeId: "t-dipc", criterionId: "c-121" }], alreadyLinked: 1, skipped: 2 });
  });

  it("la proposition embarquée se charge entièrement contre un référentiel complet", () => {
    const rows = parseProposedMatrix(PROPOSED_MATRIX_CSV);
    const plan = planFullProposalLoad(rows, {
      documentTypeIds: new Map(rows.map((r) => [r.documentTypeCode, r.documentTypeCode])),
      criterionIds: new Map(rows.map((r) => [r.criterionCode, r.criterionCode])),
      linkedPairs: new Set(),
    });
    expect(plan.toCreate.length).toBe(new Set(rows.map((r) => pairKey(r.documentTypeCode, r.criterionCode))).size);
    expect(plan.skipped).toBe(0);
  });
});

describe("planManualLinks / manualUnlinkError — rattachement à la main", () => {
  it("crée les codes connus non rattachés, compte les déjà rattachés, signale les inconnus", () => {
    expect(
      planManualLinks({
        requestedCriterionCodes: ["1.3.1", " 1.5.1 ", "1.1.1", "9.9.9", "1.3.1"],
        knownCriterionCodes: new Set(["1.3.1", "1.5.1", "1.1.1"]),
        linkedCriterionCodes: new Set(["1.1.1"]),
      })
    ).toEqual({ toCreate: ["1.3.1", "1.5.1"], alreadyLinked: ["1.1.1"], unknown: ["9.9.9"] });
  });

  it("ne retire à la main que ce qui n'est pas proposé, et seulement s'il est rattaché", () => {
    expect(manualUnlinkError({ proposed: false, linked: true })).toBeNull();
    expect(manualUnlinkError({ proposed: true, linked: true })).toMatch(/proposition/);
    expect(manualUnlinkError({ proposed: false, linked: false })).toMatch(/pas rattaché/);
  });
});
