import { describe, expect, it } from "vitest";
import {
  computeMissionProgress,
  isChecklistItemApplicable,
  type MissionItemProgress,
} from "./mission-progress-service";

// Règles de référence : .claude/context/07-outil-pilotage-missions.md §7.3-§7.4 et §12.4.

// Raccourcis de fixtures — `minFormule` par défaut = ESSENTIEL (couvert partout).
function item(
  scope: MissionItemProgress["scope"],
  completed: boolean,
  minFormule: MissionItemProgress["minFormule"] = "ESSENTIEL"
): MissionItemProgress {
  return { scope, completed, minFormule };
}

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

describe("computeMissionProgress — §7.4", () => {
  const items: MissionItemProgress[] = [
    item("DIAGNOSTIC", true),
    item("DIAGNOSTIC", false),
    item("FONDATIONS", true),
    item("FONDATIONS", true),
    item("DEPLOIEMENT", false),
    item("CONSOLIDATION", false, "EXCELLENCE"),
    item("PREPARATION_FINALE", false, "EXCELLENCE"),
  ];

  it("exclut les phases non applicables du calcul au lieu de les compter 0", () => {
    const progress = computeMissionProgress(items, "PERFORMANCE", false);
    // Phases applicables : Fondations 100 %, Déploiement 0 % → 50 %.
    expect(progress.phasesPct).toBe(50);
    expect(progress.phasePcts.CONSOLIDATION).toBeUndefined();
    expect(progress.phasePcts.PREPARATION_FINALE).toBeUndefined();
  });

  it("compte les phases réservées en périmètre Excellence", () => {
    const progress = computeMissionProgress(items, "EXCELLENCE", false);
    // 4 phases : 100 + 0 + 0 + 0 = 25 %.
    expect(progress.phasesPct).toBe(25);
  });

  it("compte les phases réservées en bêta-test gratuit, quelle que soit la formule", () => {
    expect(computeMissionProgress(items, "ESSENTIEL", true).phasePcts.CONSOLIDATION).toBe(0);
  });

  it("garde un score global 50/50 diagnostic/phases, quel que soit le nombre de phases actives", () => {
    const progress = computeMissionProgress(items, "PERFORMANCE", false);
    expect(progress.diagnosticPct).toBe(50);
    expect(progress.globalPct).toBe(50); // (50 + 50) / 2
  });

  it("fait la moyenne simple des phases, pas au prorata du nombre d'actions", () => {
    // Fondations : 1 action sur 1 cochée (100 %). Déploiement : 0 sur 3 (0 %).
    // Moyenne simple = 50 %. Au prorata des actions ce serait 25 %.
    const unbalanced: MissionItemProgress[] = [
      item("FONDATIONS", true),
      item("DEPLOIEMENT", false),
      item("DEPLOIEMENT", false),
      item("DEPLOIEMENT", false),
    ];
    expect(computeMissionProgress(unbalanced, "PERFORMANCE", false).phasesPct).toBe(50);
  });

  it("retire les items de diagnostic hors offre du dénominateur, sans les compter 0", () => {
    // 2 items Essentiel (1 coché) + 1 item réservé Performance non coché.
    const diagnostic: MissionItemProgress[] = [
      item("DIAGNOSTIC", true),
      item("DIAGNOSTIC", false),
      item("DIAGNOSTIC", false, "PERFORMANCE"),
    ];
    expect(computeMissionProgress(diagnostic, "ESSENTIEL", false).diagnosticPct).toBe(50);
    // La même mission en Performance compte les trois : 1/3 → 33 %.
    expect(computeMissionProgress(diagnostic, "PERFORMANCE", false).diagnosticPct).toBe(33);
  });

  it("laisse une mission Essentiel atteindre 100 % : les items hors offre ne plafonnent rien", () => {
    // Tous les items applicables en Essentiel sont cochés ; les items réservés
    // Performance/Excellence restent décochés. Si l'un d'eux entrait dans un
    // dénominateur, le score plafonnerait mécaniquement sous 100 % et l'offre
    // Essentiel serait invendable comme « mission terminée » (§12.4).
    const essentiel: MissionItemProgress[] = [
      item("DIAGNOSTIC", true),
      item("DIAGNOSTIC", true),
      item("DIAGNOSTIC", false, "PERFORMANCE"),
      item("FONDATIONS", true),
      item("FONDATIONS", true),
      item("FONDATIONS", true),
      item("DEPLOIEMENT", true),
      item("DEPLOIEMENT", true),
      item("DEPLOIEMENT", true),
      item("DEPLOIEMENT", true),
      item("CONSOLIDATION", false, "EXCELLENCE"),
      item("PREPARATION_FINALE", false, "EXCELLENCE"),
    ];
    const progress = computeMissionProgress(essentiel, "ESSENTIEL", false);
    expect(progress.diagnosticPct).toBe(100);
    expect(progress.phasesPct).toBe(100);
    expect(progress.globalPct).toBe(100);
  });

  it("omet une phase entièrement hors offre au lieu de renvoyer 0 ou NaN", () => {
    const mixed: MissionItemProgress[] = [
      item("FONDATIONS", true),
      item("CONSOLIDATION", false, "EXCELLENCE"),
      item("CONSOLIDATION", true, "EXCELLENCE"),
    ];
    const progress = computeMissionProgress(mixed, "ESSENTIEL", false);
    expect("CONSOLIDATION" in progress.phasePcts).toBe(false);
    expect(progress.phasePcts.CONSOLIDATION).toBeUndefined();
    expect(Number.isNaN(progress.phasesPct)).toBe(false);
    expect(progress.phasesPct).toBe(100); // seule Fondations compte
  });

  it("ne divise jamais par zéro sur une mission sans item", () => {
    const progress = computeMissionProgress([], "ESSENTIEL", false);
    expect(progress).toMatchObject({ diagnosticPct: 0, phasesPct: 0, globalPct: 0 });
  });
});
