import { describe, expect, it } from "vitest";
import {
  computeMissionProgress,
  explainMissionProgress,
  isChecklistItemApplicable,
  MISSION_STEPS,
  PHASE_LABELS,
  stepPercent,
  stepTitle,
  PHASE_ORDER,
  type MissionItemProgress,
} from "./mission-progress-service";
import type { ComplianceDocuments } from "./mission-document-counters-service";

// Règles de référence : .claude/context/07-outil-pilotage-missions.md §7.3-§7.4 et §12.4.

// Raccourcis de fixtures — `minFormule` par défaut = ESSENTIEL (couvert partout).
function item(
  scope: MissionItemProgress["scope"],
  completed: boolean,
  minFormule: MissionItemProgress["minFormule"] = "ESSENTIEL"
): MissionItemProgress {
  return { scope, completed, minFormule };
}

function docs(proven: number, expected: number, mode: ComplianceDocuments["mode"] = "ACCOMPAGNE"): ComplianceDocuments {
  return { proven, expected, mode };
}

describe("Étapes de mission — décision 3 corrigée le 10/10/2026", () => {
  it("quatre étapes : Diagnostic (checklist) / Mise en conformité / Suivi / Préparation finale", () => {
    expect(MISSION_STEPS.map(stepTitle)).toEqual([
      "Étape 1 — Diagnostic",
      "Étape 2 — Mise en conformité",
      "Étape 3 — Suivi",
      "Étape 4 — Préparation finale",
    ]);
    expect(MISSION_STEPS.map((s) => s.phases)).toEqual([
      [],
      ["FONDATIONS", "DEPLOIEMENT"],
      ["CONSOLIDATION"],
      ["PREPARATION_FINALE"],
    ]);
  });

  it("chaque phase stockée appartient à exactement une étape", () => {
    const grouped = MISSION_STEPS.flatMap((s) => s.phases);
    expect([...grouped].sort()).toEqual([...PHASE_ORDER].sort());
  });

  it("FONDATIONS n'est plus libellée « Diagnostic » : elle reste éditable sous la mise en conformité", () => {
    expect(PHASE_ORDER.map((phase) => PHASE_LABELS[phase])).toEqual([
      "Mise en conformité — fondations",
      "Mise en conformité — déploiement",
      "Suivi",
      "Préparation finale",
    ]);
    expect(PHASE_ORDER).toEqual(["FONDATIONS", "DEPLOIEMENT", "CONSOLIDATION", "PREPARATION_FINALE"]);
  });

  it("stepPercent lit l'avancement calculé de l'étape ; undefined = hors formule", () => {
    const progress = computeMissionProgress([item("DIAGNOSTIC", true), item("FONDATIONS", true)], "PERFORMANCE", false, docs(1, 4));
    const [diag, conformite, suivi] = MISSION_STEPS;
    expect(diag && stepPercent(diag, progress)).toBe(100);
    expect(conformite && stepPercent(conformite, progress)).toBe(25);
    expect(suivi && stepPercent(suivi, progress)).toBeUndefined();
  });
});

describe("isChecklistItemApplicable — §12.4 filtrage par offre", () => {
  it("verrouille un item réservé Excellence hors périmètre Excellence", () => {
    expect(isChecklistItemApplicable("EXCELLENCE", "PERFORMANCE", false)).toBe(false);
    expect(isChecklistItemApplicable("EXCELLENCE", "ESSENTIEL", false)).toBe(false);
  });

  it("le déverrouille en Excellence comme en bêta-test gratuit", () => {
    expect(isChecklistItemApplicable("EXCELLENCE", "EXCELLENCE", false)).toBe(true);
    expect(isChecklistItemApplicable("EXCELLENCE", "ESSENTIEL", true)).toBe(true);
  });

  it("verrouille un item de diagnostic réservé Performance en offre Essentiel", () => {
    expect(isChecklistItemApplicable("PERFORMANCE", "ESSENTIEL", false)).toBe(false);
    expect(isChecklistItemApplicable("PERFORMANCE", "PERFORMANCE", false)).toBe(true);
  });

  it("laisse un item ESSENTIEL accessible à toutes les offres", () => {
    for (const formule of ["ESSENTIEL", "PERFORMANCE", "EXCELLENCE", "BETA"] as const) {
      expect(isChecklistItemApplicable("ESSENTIEL", formule, false)).toBe(true);
    }
  });
});

// Call du 09/11/2026 (Sandrine) : « Mise en conformité à 100 % alors que la phase
// est à 50 % » — l'étape suivait des cases cochées. « Ce qui doit refléter
// l'avancement, ce sont les documents validés / prouvés. » L'étape 2 = la part des
// documents attendus PROUVÉS ; ses cases (fondations, déploiement) restent des jalons.
describe("computeMissionProgress — quatre étapes, la mise en conformité compte les documents", () => {
  const items: MissionItemProgress[] = [
    item("DIAGNOSTIC", true),
    item("DIAGNOSTIC", false),
    item("FONDATIONS", true),
    item("FONDATIONS", true),
    item("DEPLOIEMENT", true),
    item("CONSOLIDATION", false, "EXCELLENCE"),
    item("PREPARATION_FINALE", false, "EXCELLENCE"),
  ];

  it("les cases cochées de la mise en conformité ne la font plus monter : seuls les documents prouvés", () => {
    const progress = computeMissionProgress(items, "PERFORMANCE", false, docs(41, 76));
    expect(progress.phasePcts).toMatchObject({ FONDATIONS: 100, DEPLOIEMENT: 100 });
    expect(progress.stepPcts.MISE_EN_CONFORMITE).toBe(54);
  });

  it("une étape à 100 % exige 100 % des documents prouvés", () => {
    expect(computeMissionProgress(items, "PERFORMANCE", false, docs(75, 76)).stepPcts.MISE_EN_CONFORMITE).toBe(99);
    expect(computeMissionProgress(items, "PERFORMANCE", false, docs(76, 76)).stepPcts.MISE_EN_CONFORMITE).toBe(100);
  });

  it("n'arrondit jamais à 100 % ce qui n'est pas entièrement prouvé", () => {
    expect(computeMissionProgress(items, "PERFORMANCE", false, docs(199, 200)).stepPcts.MISE_EN_CONFORMITE).toBe(99);
  });

  it("aucun document attendu : 0 %, jamais NaN ni 100 % par défaut", () => {
    expect(computeMissionProgress(items, "PERFORMANCE", false, docs(0, 0)).stepPcts.MISE_EN_CONFORMITE).toBe(0);
  });

  it("global = moyenne simple des étapes APPLICABLES (une étape hors formule est retirée, pas comptée 0)", () => {
    const progress = computeMissionProgress(items, "PERFORMANCE", false, docs(41, 76));
    // Diagnostic 50 %, Mise en conformité 54 % ; Suivi et Préparation finale hors formule.
    expect(progress.stepPcts).toEqual({ DIAGNOSTIC: 50, MISE_EN_CONFORMITE: 54 });
    expect(progress.globalPct).toBe(52);
  });

  it("compte les étapes réservées en Excellence et en bêta-test gratuit", () => {
    expect(computeMissionProgress(items, "EXCELLENCE", false, docs(41, 76)).stepPcts).toEqual({
      DIAGNOSTIC: 50,
      MISE_EN_CONFORMITE: 54,
      SUIVI: 0,
      PREPARATION_FINALE: 0,
    });
    expect(computeMissionProgress(items, "ESSENTIEL", true, docs(0, 1)).stepPcts.SUIVI).toBe(0);
  });

  it("garde l'avancement de chaque phase (jalons) : cases cochées sur cases applicables", () => {
    const progress = computeMissionProgress(
      [item("FONDATIONS", true), item("DEPLOIEMENT", false), item("DEPLOIEMENT", false)],
      "PERFORMANCE",
      false,
      docs(0, 1)
    );
    expect(progress.phasePcts).toEqual({ FONDATIONS: 100, DEPLOIEMENT: 0 });
  });

  it("retire les items de diagnostic hors offre du dénominateur, sans les compter 0", () => {
    const diagnostic: MissionItemProgress[] = [
      item("DIAGNOSTIC", true),
      item("DIAGNOSTIC", false),
      item("DIAGNOSTIC", false, "PERFORMANCE"),
    ];
    expect(computeMissionProgress(diagnostic, "ESSENTIEL", false, docs(0, 1)).diagnosticPct).toBe(50);
    expect(computeMissionProgress(diagnostic, "PERFORMANCE", false, docs(0, 1)).diagnosticPct).toBe(33);
  });

  it("une mission Essentiel atteint 100 % quand son diagnostic est coché et ses documents prouvés", () => {
    const essentiel: MissionItemProgress[] = [
      item("DIAGNOSTIC", true),
      item("DIAGNOSTIC", false, "PERFORMANCE"),
      item("FONDATIONS", false),
      item("CONSOLIDATION", false, "EXCELLENCE"),
      item("PREPARATION_FINALE", false, "EXCELLENCE"),
    ];
    expect(computeMissionProgress(essentiel, "ESSENTIEL", false, docs(7, 7)).globalPct).toBe(100);
  });

  it("ne divise jamais par zéro sur une mission sans item ni document", () => {
    expect(computeMissionProgress([], "ESSENTIEL", false, docs(0, 0))).toMatchObject({ diagnosticPct: 0, globalPct: 0 });
  });
});

// Retour de Sandrine (08/11 puis 09/11/2026) : « comment est-ce calculé ? ». Chaque
// pourcentage porte sa phrase, avec les vrais nombres.
describe("explainMissionProgress — le calcul écrit sous chaque chiffre", () => {
  const items: MissionItemProgress[] = [
    ...Array.from({ length: 11 }, () => item("DIAGNOSTIC", true)),
    item("DIAGNOSTIC", false),
    item("FONDATIONS", true),
    item("DEPLOIEMENT", false),
    item("CONSOLIDATION", false),
    item("PREPARATION_FINALE", false),
  ];
  const progress = computeMissionProgress(items, "EXCELLENCE", false, docs(41, 76));

  it("cas du 09/11 : diagnostic 92 %, mise en conformité 54 % (documents), global 37 %", () => {
    expect([progress.diagnosticPct, progress.stepPcts.MISE_EN_CONFORMITE, progress.globalPct]).toEqual([92, 54, 37]);
  });

  it("compte les cases cochées par périmètre", () => {
    expect(progress.counts.DIAGNOSTIC).toEqual({ done: 11, total: 12 });
    expect(progress.counts.CONSOLIDATION).toEqual({ done: 0, total: 1 });
  });

  it("dit d'où vient chaque pourcentage, avec les vrais nombres", () => {
    const text = explainMissionProgress(progress);
    expect(text.diagnostic).toBe("11 cases cochées sur 12 dans la checklist de diagnostic.");
    expect(text.conformite).toBe(
      "41 documents prouvés sur 76 attendus par l'offre (validés par EODA). Jalons cochés, pour information : fondations 100 %, déploiement 0 %."
    );
    expect(text.global).toBe(
      "Moyenne des 4 étapes : Diagnostic 92 %, Mise en conformité 54 %, Suivi 0 %, Préparation finale 0 % = 37 %."
    );
  });

  it("en autonomie, prouvé se dit « acceptés par la structure » ; un seul document au singulier", () => {
    const autonomy = computeMissionProgress(items, "EXCELLENCE", false, docs(1, 7, "AUTONOMIE"));
    expect(explainMissionProgress(autonomy).conformite).toMatch(
      /^1 document prouvé sur 7 attendus par l'offre \(acceptés par la structure\)\./
    );
  });

  it("dit que la mise en conformité compte des documents et les autres étapes des cases", () => {
    const note = explainMissionProgress(progress).note;
    expect(note).toContain("documents prouvés");
    expect(note).toContain("cases cochées");
  });

  it("ne cite pas une étape hors formule", () => {
    const performance = computeMissionProgress(
      [item("DIAGNOSTIC", true), item("CONSOLIDATION", false, "EXCELLENCE")],
      "PERFORMANCE",
      false,
      docs(0, 2)
    );
    expect(explainMissionProgress(performance).global).toBe(
      "Moyenne des 2 étapes : Diagnostic 100 %, Mise en conformité 0 % = 50 %."
    );
  });
});
