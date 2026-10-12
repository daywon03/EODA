import { describe, expect, it } from "vitest";
import type { CriterionProofRow, ProofStatus } from "./criteria-proof-service";
import {
  buildDiagnosticSnapshot,
  buildDiagnosticSummary,
  derivePriorityActions,
  describeDiagnosticLine,
  describePriorityProves,
  diagnosticFingerprint,
  groupDiagnosticChapters,
  parseDiagnosticSnapshot,
} from "./diagnostic-service";

function row(code: string, status: ProofStatus, opts: { imperative?: boolean; types?: string[]; chapter?: number } = {}): CriterionProofRow {
  return {
    id: `c-${code}`,
    code,
    label: `Critère ${code}`,
    chapterNumber: opts.chapter ?? Number(code.split(".")[0]),
    isImperative: opts.imperative ?? true,
    expectedDocumentTypeIds: opts.types ?? [],
    status,
    expected: opts.types?.length ?? 0,
    deposited: 0,
    proven: status === "PROUVE" ? (opts.types?.length ?? 0) : 0,
  };
}

const ROWS: CriterionProofRow[] = [
  row("2.2.2", "PROUVE", { types: ["livret"] }),
  row("3.12.1", "SANS_PREUVE", { types: ["plaintes", "registre"] }),
  row("3.12.2", "SANS_PREUVE", { types: ["plaintes"] }),
  row("3.14.1", "SANS_PREUVE", { types: ["pca"] }),
  row("3.11.1", "EN_PARTIE", { types: ["maltraitance"] }),
  row("3.13.1", "NON_RATTACHE"),
  row("1.1.1", "SANS_PREUVE", { imperative: false, types: ["livret"] }),
];

describe("buildDiagnosticSummary", () => {
  const summary = buildDiagnosticSummary(ROWS);

  it("compte les impératifs seulement, chacun une fois", () => {
    expect(summary.imperatives).toEqual({ proven: 1, total: 6 });
    expect(Object.fromEntries(summary.counters.map((c) => [c.state, c.count]))).toEqual({
      PROUVE: 1,
      EN_PARTIE: 1,
      SANS_PREUVE: 3,
    });
  });

  it("met à part les impératifs sans document attendu, et définit chaque état", () => {
    expect(summary.imperativesWithoutExpectedDocument).toBe(1);
    for (const counter of summary.counters) expect(counter.definition.length).toBeGreaterThan(10);
    expect(summary.counters.map((c) => c.label)).toEqual(["Prouvé", "En partie", "Sans preuve"]);
  });

  it("ne parle jamais de conformité", () => {
    expect(JSON.stringify(summary)).not.toMatch(/conforme/i);
  });
});

describe("describeDiagnosticLine", () => {
  it("dit le nombre prouvé sur le total réel", () => {
    expect(describeDiagnosticLine({ proven: 3, total: 16 })).toBe(
      "3 critères impératifs sur 16 sont prouvés. 13 restent à travailler."
    );
    expect(describeDiagnosticLine({ proven: 1, total: 17 })).toBe("1 critère impératif sur 17 est prouvé. 16 restent à travailler.");
    expect(describeDiagnosticLine({ proven: 16, total: 16 })).toMatch(/Tous sont prouvés/);
    expect(describeDiagnosticLine({ proven: 15, total: 16 })).toMatch(/1 reste à travailler/);
    expect(describeDiagnosticLine({ proven: 0, total: 0 })).toMatch(/Aucun critère impératif/);
  });
});

describe("derivePriorityActions", () => {
  const labels = new Map([
    ["plaintes", "Procédure plaintes"],
    ["registre", "Registre des plaintes"],
    ["pca", "Plan de continuité"],
    ["livret", "Livret d'accueil"],
  ]);

  it("classe les documents par nombre d'impératifs sans preuve qu'ils prouveraient", () => {
    const actions = derivePriorityActions(ROWS, labels);
    expect(actions.map((a) => a.documentTypeId)).toEqual(["plaintes", "registre", "pca"]);
    expect(actions[0]!.proves.map((p) => p.code)).toEqual(["3.12.1", "3.12.2"]);
    expect(describePriorityProves(actions[0]!)).toBe("Prouve 2 critères impératifs : 3.12.1, 3.12.2");
    expect(describePriorityProves(actions[2]!)).toBe("Prouve 1 critère impératif : 3.14.1");
  });

  it("ignore les standards, les critères en partie ou prouvés, et les types sans libellé", () => {
    const actions = derivePriorityActions(ROWS, new Map([["pca", "Plan de continuité"]]));
    expect(actions.map((a) => a.documentTypeId)).toEqual(["pca"]);
    expect(derivePriorityActions(ROWS, labels).some((a) => a.documentTypeId === "livret")).toBe(false);
  });

  it("borne la liste", () => {
    expect(derivePriorityActions(ROWS, labels, 1)).toHaveLength(1);
    expect(derivePriorityActions([], labels)).toEqual([]);
  });
});

describe("groupDiagnosticChapters", () => {
  const chapters = [
    { number: 3, name: "La structure" },
    { number: 1, name: "La personne" },
    { number: 2, name: "Les professionnels" },
  ];

  it("range les impératifs seuls par chapitre, dans l'ordre", () => {
    const grouped = groupDiagnosticChapters(ROWS, chapters, false);
    expect(grouped.map((c) => c.number)).toEqual([1, 2, 3]);
    expect(grouped[0]!.rows).toEqual([]);
    expect(grouped[0]!.summary).toBe("aucun critère impératif");
    expect(grouped[1]!.summary).toBe("1 prouvé sur 1");
    expect(grouped[2]!.summary).toBe("0 prouvé sur 5");
    expect(grouped[2]!.title).toBe("Chapitre 3 — La structure");
  });

  it("montre tout le référentiel quand l'offre le couvre", () => {
    const grouped = groupDiagnosticChapters(ROWS, chapters, true);
    expect(grouped[0]!.rows.map((r) => r.code)).toEqual(["1.1.1"]);
    expect(groupDiagnosticChapters([], chapters, true)[0]!.summary).toBe("aucun critère");
    expect(groupDiagnosticChapters([row("2.2.2", "PROUVE"), row("2.2.3", "PROUVE")], chapters, true)[1]!.summary).toBe(
      "2 prouvés sur 2"
    );
  });
});

describe("photo et empreinte du diagnostic", () => {
  const takenAt = new Date("2026-10-12T09:00:00Z");

  it("fige l'état et se relit à l'identique", () => {
    const snapshot = buildDiagnosticSnapshot(ROWS, takenAt);
    const parsed = parseDiagnosticSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed).toEqual(snapshot);
    expect(diagnosticFingerprint(parsed!.rows)).toBe(diagnosticFingerprint(ROWS));
  });

  it("une empreinte change quand un statut change, pas quand l'ordre change", () => {
    const reordered = [...ROWS].reverse();
    expect(diagnosticFingerprint(reordered)).toBe(diagnosticFingerprint(ROWS));
    const changed = ROWS.map((r) => (r.code === "3.14.1" ? { ...r, status: "PROUVE" as const } : r));
    expect(diagnosticFingerprint(changed)).not.toBe(diagnosticFingerprint(ROWS));
  });

  it.each([
    null,
    "texte",
    { version: 2, takenAt: "x", rows: [], imperatives: { proven: 0, total: 0 } },
    { version: 1, takenAt: "x", rows: [], imperatives: { proven: "0", total: 0 } },
    { version: 1, takenAt: "x", rows: [{ code: "1", label: "l", isImperative: true, status: "CONFORME" }], imperatives: { proven: 0, total: 0 } },
    { version: 1, takenAt: "x", rows: ["chaîne"], imperatives: { proven: 0, total: 0 } },
    { version: 1, takenAt: "x", rows: "pas un tableau", imperatives: { proven: 0, total: 0 } },
  ])("une photo illisible vaut « pas de photo » (%#)", (value) => {
    expect(parseDiagnosticSnapshot(value)).toBeNull();
  });
});
