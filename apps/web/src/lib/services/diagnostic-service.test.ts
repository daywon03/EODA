import { describe, expect, it } from "vitest";
import type { CriterionProofRow, ProofStatus } from "./criteria-proof-service";
import {
  buildDiagnosticSnapshot,
  buildDiagnosticSummary,
  derivePriorityActions,
  describeDiagnosticLine,
  describeDiagnosticOffer,
  describePriorityProves,
  diagnosticFingerprint,
  groupDiagnosticChapters,
  describeChaptersScope,
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
  const summary = buildDiagnosticSummary(ROWS, false);

  it("offre limitée aux impératifs (Essentiel) : les cartes comptent les impératifs, chacun une fois", () => {
    expect(summary.imperatives).toEqual({ proven: 1, total: 6 });
    expect(summary.scope).toEqual({ all: false, proven: 1, total: 6 });
    expect(Object.fromEntries(summary.counters.map((c) => [c.state, c.count]))).toEqual({
      PROUVE: 1,
      EN_PARTIE: 1,
      SANS_PREUVE: 3,
    });
  });

  // Call du 09/11/2026 : « Performance + Excellence = tous les critères ». Les cartes
  // et la liste comptent alors la même chose.
  it("offre qui couvre tout (Performance, Excellence, bêta) : les cartes comptent tout le périmètre", () => {
    const all = buildDiagnosticSummary(ROWS, true);
    expect(all.scope).toEqual({ all: true, proven: 1, total: 7 });
    expect(all.imperatives).toEqual({ proven: 1, total: 6 });
    expect(Object.fromEntries(all.counters.map((c) => [c.state, c.count]))).toEqual({
      PROUVE: 1,
      EN_PARTIE: 1,
      SANS_PREUVE: 4,
    });
  });

  it("met à part les critères sans document attendu, et définit chaque état", () => {
    expect(summary.withoutExpectedDocument).toBe(1);
    for (const counter of summary.counters) expect(counter.definition.length).toBeGreaterThan(10);
    expect(summary.counters.map((c) => c.label)).toEqual(["Prouvé", "En partie", "Sans preuve"]);
  });

  it("ne parle jamais de conformité", () => {
    expect(JSON.stringify(summary)).not.toMatch(/conforme/i);
  });
});

describe("describeDiagnosticLine", () => {
  const imperativesOnly = (proven: number, total: number) => ({
    imperatives: { proven, total },
    scope: { all: false, proven, total },
  });

  it("impératifs seuls : dit le nombre prouvé sur le total réel", () => {
    expect(describeDiagnosticLine(imperativesOnly(3, 16))).toBe(
      "3 critères impératifs sur 16 sont prouvés. 13 restent à travailler."
    );
    expect(describeDiagnosticLine(imperativesOnly(1, 17))).toBe("1 critère impératif sur 17 est prouvé. 16 restent à travailler.");
    // Le travail déjà engagé se dit (21/10/2026).
    expect(describeDiagnosticLine(imperativesOnly(0, 16), 16)).toBe(
      "0 critère impératif sur 16 est prouvé. 16 restent à travailler (dont 16 déjà en partie : une pièce attendue reste à relire ou à déposer)."
    );
    expect(describeDiagnosticLine(imperativesOnly(16, 16))).toMatch(/Tous sont prouvés/);
    expect(describeDiagnosticLine(imperativesOnly(15, 16))).toMatch(/1 reste à travailler/);
    expect(describeDiagnosticLine(imperativesOnly(0, 0))).toMatch(/Aucun critère impératif/);
  });

  it("tout le périmètre : les critères prouvés, dont les impératifs", () => {
    expect(
      describeDiagnosticLine({ imperatives: { proven: 9, total: 16 }, scope: { all: true, proven: 41, total: 137 } }, 3)
    ).toBe("41 critères sur 137 sont prouvés, dont 9 impératifs sur 16. 96 restent à travailler.");
    expect(
      describeDiagnosticLine({ imperatives: { proven: 16, total: 16 }, scope: { all: true, proven: 137, total: 137 } })
    ).toBe("137 critères sur 137 sont prouvés, dont 16 impératifs sur 16. Tous sont prouvés.");
    expect(describeDiagnosticLine({ imperatives: { proven: 0, total: 0 }, scope: { all: true, proven: 0, total: 0 } })).toMatch(
      /Aucun critère n'est encore chargé/
    );
  });
});

describe("describeDiagnosticOffer — le rapport nomme l'offre qui le filtre", () => {
  it("nomme l'offre de la mission et ce qu'elle couvre", () => {
    expect(describeDiagnosticOffer("ESSENTIEL", false)).toBe("Offre Essentiel : les critères impératifs seulement");
    expect(describeDiagnosticOffer("PERFORMANCE", false)).toBe("Offre Performance : tous les critères de votre périmètre");
    expect(describeDiagnosticOffer("EXCELLENCE", false)).toBe("Offre Excellence : tous les critères de votre périmètre");
    expect(describeDiagnosticOffer("BETA", false)).toBe("Bêta-test : tous les critères de votre périmètre");
    expect(describeDiagnosticOffer("ESSENTIEL", true)).toBe("Bêta-test : tous les critères de votre périmètre");
  });

  it("sans offre ou sans mission : les impératifs, et on le dit", () => {
    expect(describeDiagnosticOffer(null, false)).toBe("Prestations à la carte : les critères impératifs seulement");
    expect(describeDiagnosticOffer(undefined, false)).toBe("Aucune mission : les critères impératifs seulement");
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

// Retour de Sandrine (08/11/2026) : « 0 impératif prouvé, 16 en partie, 0 sans
// preuve » en tête du rapport, puis des critères « Prouvé » et « Sans preuve » dans
// la liste — incohérent à la lecture. Les cartes comptent les IMPÉRATIFS ; la liste
// montre tout le périmètre. Le rapport le dit, et chaque chapitre donne les deux.
describe("rapport : impératifs et périmètre complet, distingués", () => {
  const chapters = [{ number: 1, name: "La personne" }];
  const rows = [
    row("1.1.1", "EN_PARTIE", { imperative: true, chapter: 1 }),
    row("1.2.1", "PROUVE", { imperative: false, chapter: 1 }),
    row("1.7.2", "SANS_PREUVE", { imperative: false, chapter: 1 }),
  ];

  it("le résumé d'un chapitre complet donne aussi les impératifs", () => {
    expect(groupDiagnosticChapters(rows, chapters, true)[0]!.summary).toBe(
      "1 prouvé sur 3 · impératifs : 0 prouvé sur 1"
    );
  });

  it("le résumé reste inchangé quand seuls les impératifs sont listés", () => {
    expect(groupDiagnosticChapters(rows, chapters, false)[0]!.summary).toBe("0 prouvé sur 1");
  });

  it("dit ce que montre la liste : la même chose que les cartes du haut", () => {
    expect(describeChaptersScope(true, 137)).toBe(
      "La liste montre les 137 critères de votre périmètre, les mêmes que les cartes du haut. Les critères impératifs sont marqués ▲ Impératif."
    );
    expect(describeChaptersScope(false, 16)).toBe("La liste montre vos 16 critères impératifs, les mêmes que les cartes du haut.");
  });
});
