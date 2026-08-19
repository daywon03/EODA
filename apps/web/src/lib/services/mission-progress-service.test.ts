import { describe, expect, it } from "vitest";
import {
  computeMissionProgress,
  isExcellenceScope,
  isScopeApplicable,
  type MissionItemProgress,
} from "./mission-progress-service";
import { getOfferScope } from "./offer-scope-service";

// Règles de référence : .claude/context/07-outil-pilotage-missions.md §7.3-§7.4.

describe("isExcellenceScope — §7.3 / §7.5", () => {
  it("accorde le périmètre Excellence à la formule EXCELLENCE", () => {
    expect(isExcellenceScope("EXCELLENCE", false)).toBe(true);
  });

  it("accorde le périmètre Excellence à une mission bêta-test gratuite, quelle que soit la formule", () => {
    expect(isExcellenceScope("ESSENTIEL", true)).toBe(true);
    expect(isExcellenceScope("PERFORMANCE", true)).toBe(true);
  });

  it("le refuse à Essentiel et Performance payants", () => {
    expect(isExcellenceScope("ESSENTIEL", false)).toBe(false);
    expect(isExcellenceScope("PERFORMANCE", false)).toBe(false);
  });
});

describe("isScopeApplicable — §7.3 verrouillage des phases 3 et 4", () => {
  it("verrouille Consolidation et Préparation finale hors périmètre Excellence", () => {
    expect(isScopeApplicable("CONSOLIDATION", "PERFORMANCE", false)).toBe(false);
    expect(isScopeApplicable("PREPARATION_FINALE", "PERFORMANCE", false)).toBe(false);
  });

  it("les déverrouille en Excellence comme en bêta-test gratuit", () => {
    expect(isScopeApplicable("CONSOLIDATION", "EXCELLENCE", false)).toBe(true);
    expect(isScopeApplicable("PREPARATION_FINALE", "ESSENTIEL", true)).toBe(true);
  });

  it("laisse Diagnostic, Fondations et Déploiement toujours accessibles", () => {
    for (const scope of ["DIAGNOSTIC", "FONDATIONS", "DEPLOIEMENT"] as const) {
      expect(isScopeApplicable(scope, "ESSENTIEL", false)).toBe(true);
    }
  });
});

describe("computeMissionProgress — §7.4", () => {
  const items: MissionItemProgress[] = [
    { scope: "DIAGNOSTIC", completed: true },
    { scope: "DIAGNOSTIC", completed: false },
    { scope: "FONDATIONS", completed: true },
    { scope: "FONDATIONS", completed: true },
    { scope: "DEPLOIEMENT", completed: false },
    { scope: "CONSOLIDATION", completed: false },
    { scope: "PREPARATION_FINALE", completed: false },
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

  it("garde un score global 50/50 diagnostic/phases, quel que soit le nombre de phases actives", () => {
    const progress = computeMissionProgress(items, "PERFORMANCE", false);
    expect(progress.diagnosticPct).toBe(50);
    expect(progress.globalPct).toBe(50); // (50 + 50) / 2
  });

  it("fait la moyenne simple des phases, pas au prorata du nombre d'actions", () => {
    // Fondations : 1 action sur 1 cochée (100 %). Déploiement : 0 sur 3 (0 %).
    // Moyenne simple = 50 %. Au prorata des actions ce serait 25 %.
    const unbalanced: MissionItemProgress[] = [
      { scope: "FONDATIONS", completed: true },
      { scope: "DEPLOIEMENT", completed: false },
      { scope: "DEPLOIEMENT", completed: false },
      { scope: "DEPLOIEMENT", completed: false },
    ];
    expect(computeMissionProgress(unbalanced, "PERFORMANCE", false).phasesPct).toBe(50);
  });

  it("ne divise jamais par zéro sur une mission sans item", () => {
    const progress = computeMissionProgress([], "ESSENTIEL", false);
    expect(progress).toMatchObject({ diagnosticPct: 0, phasesPct: 0, globalPct: 0 });
  });
});

describe("getOfferScope — périmètre des offres", () => {
  it("limite l'Essentiel aux critères impératifs, sans correction documentaire", () => {
    expect(getOfferScope("ESSENTIEL")).toEqual({
      criteriaScope: "IMPERATIFS_ONLY",
      correctionScope: "NONE",
    });
  });

  it("ouvre Performance à tous les critères, avec correction limitée à la loi 2002-2", () => {
    expect(getOfferScope("PERFORMANCE")).toEqual({
      criteriaScope: "ALL",
      correctionScope: "LOI_2002_2_ONLY",
    });
  });

  it("ouvre tout en Excellence", () => {
    expect(getOfferScope("EXCELLENCE")).toEqual({
      criteriaScope: "ALL",
      correctionScope: "ALL",
    });
  });

  it("accorde le périmètre Excellence au bêta-test (BETA) — cohérent avec isExcellenceScope", () => {
    expect(getOfferScope("BETA")).toEqual(getOfferScope("EXCELLENCE"));
  });
});
