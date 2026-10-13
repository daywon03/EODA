import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildQuizMatrix,
  countUpToDate,
  deriveQuizCell,
  listRetestsDue,
  preselectForCampaign,
  retestTaskTitle,
  retestTasksToCreate,
} from "./quiz-status-service";

const NOW = new Date(2026, 9, 13);
const at = (y: number, m: number, d: number) => new Date(y, m, d);
const attempt = (staffMemberId: string, moduleCode: string, passed: boolean, completedAt: Date) => ({
  staffMemberId,
  moduleCode,
  passed,
  completedAt,
});

describe("addMonths", () => {
  it("ajoute des mois de calendrier, un 31 tombe au dernier jour du mois", () => {
    expect(addMonths(at(2026, 0, 15), 6)).toEqual(at(2026, 6, 15));
    expect(addMonths(at(2026, 7, 31), 6)).toEqual(at(2027, 1, 28));
  });
});

describe("deriveQuizCell — état dérivé, jamais stocké", () => {
  it("aucune tentative : pas fait", () => {
    expect(deriveQuizCell([], 6, NOW).status).toBe("PAS_FAIT");
  });

  it("des tentatives sans réussite : à refaire", () => {
    expect(deriveQuizCell([attempt("s", "M", false, at(2026, 9, 1))], 6, NOW).status).toBe("A_REFAIRE");
  });

  it("une réussite récente : à jour, avec son échéance", () => {
    const cell = deriveQuizCell([attempt("s", "M", true, at(2026, 6, 1))], 6, NOW);
    expect(cell).toEqual({ status: "A_JOUR", lastPassedAt: at(2026, 6, 1), dueOn: at(2027, 0, 1) });
  });

  it("une réussite de plus de 6 mois : à refaire", () => {
    expect(deriveQuizCell([attempt("s", "M", true, at(2026, 3, 12))], 6, NOW).status).toBe("A_REFAIRE");
  });

  it("un échec APRÈS une réussite valide ne la retire pas", () => {
    const cell = deriveQuizCell([attempt("s", "M", true, at(2026, 8, 1)), attempt("s", "M", false, at(2026, 9, 1))], 6, NOW);
    expect(cell.status).toBe("A_JOUR");
  });
});

const MODULES = [
  { code: "A", retestMonths: 6 },
  { code: "B", retestMonths: 6 },
];
const STAFF = [
  { id: "s1", displayName: "Personne 1 (fictive)", jobTitle: "Aide à domicile" },
  { id: "s2", displayName: "Personne 2 (fictive)", jobTitle: "Auxiliaire de vie" },
];

describe("matrice, tuiles et présélection", () => {
  const rows = buildQuizMatrix(
    STAFF,
    MODULES,
    [attempt("s1", "A", true, at(2026, 9, 1)), attempt("s2", "A", true, at(2026, 4, 1)), attempt("s2", "B", false, at(2026, 9, 2))],
    NOW
  );

  it("une cellule par personne et par module, et la dernière tentative", () => {
    expect(rows[0]?.cells.A?.status).toBe("A_JOUR");
    expect(rows[0]?.cells.B?.status).toBe("PAS_FAIT");
    expect(rows[1]?.cells.A?.status).toBe("A_JOUR");
    expect(rows[1]?.cells.B?.status).toBe("A_REFAIRE");
    expect(rows[1]?.lastAttemptAt).toEqual(at(2026, 9, 2));
  });

  it("compte les personnes à jour par module", () => {
    expect(countUpToDate(rows, "A")).toEqual({ upToDate: 2, total: 2 });
    expect(countUpToDate(rows, "B")).toEqual({ upToDate: 0, total: 2 });
  });

  it("pré-coche ceux qui doivent le faire, le refaire, ou dont l'échéance approche", () => {
    // s2 a réussi A le 01/05 : échéance 01/11, dans moins de 30 jours.
    expect(preselectForCampaign(rows, "A", NOW)).toEqual(["s2"]);
    expect(preselectForCampaign(rows, "B", NOW)).toEqual(["s1", "s2"]);
  });

  it("liste les rappels dus dans les 30 jours, du plus proche au plus lointain", () => {
    expect(listRetestsDue(rows, NOW)).toEqual([{ staffMemberId: "s2", moduleCode: "A", dueOn: at(2026, 10, 1) }]);
  });
});

describe("alerte d'échéance (D12) — idempotente", () => {
  const due = [
    { staffMemberId: "s1", moduleCode: "A", dueOn: at(2026, 10, 5) },
    { staffMemberId: "s2", moduleCode: "A", dueOn: at(2026, 10, 1) },
  ];
  const titles = new Map([["A", "Bientraitance"]]);

  it("une tâche par module, échéance au plus tôt, sans nom dans le titre", () => {
    expect(retestTasksToCreate(due, titles, new Set())).toEqual([
      { moduleCode: "A", title: retestTaskTitle("Bientraitance"), dueOn: at(2026, 10, 1) },
    ]);
    expect(retestTaskTitle("Bientraitance")).not.toMatch(/fictive/);
  });

  it("rien à créer quand la tâche ouverte existe déjà", () => {
    expect(retestTasksToCreate(due, titles, new Set([retestTaskTitle("Bientraitance")]))).toEqual([]);
  });

  it("un module inconnu du contenu est ignoré", () => {
    expect(retestTasksToCreate([{ staffMemberId: "s", moduleCode: "Z", dueOn: NOW }], titles, new Set())).toEqual([]);
  });
});
