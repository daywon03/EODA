import { describe, expect, it } from "vitest";
import type { MissionLifecycleFacts } from "./lifecycle-service";
import { countUpcomingHasEvaluations, type PortfolioRow } from "./portfolio-kpi-service";

// Seul compteur de portefeuille encore affiché (accueil cabinet, « Évaluations HAS dans
// moins de 6 mois »). Les agrégats que plus aucun écran n'affichait ont été retirés
// avec leurs tests en tranche 11.

const NOW = new Date("2026-09-01T00:00:00Z");

function mission(overrides: Partial<MissionLifecycleFacts> = {}): MissionLifecycleFacts {
  return {
    closedAt: null,
    gratuit: false,
    completedChecklistCount: 0,
    scheduledPhaseDateCount: 0,
    ...overrides,
  };
}

function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    mission: mission(),
    hasEvaluationTargetDate: null,
    ...overrides,
  };
}

describe("countUpcomingHasEvaluations", () => {
  const within = { now: NOW, withinDays: 180 };

  it("compte l'échéance située dans l'horizon", () => {
    const rows = [row({ hasEvaluationTargetDate: new Date("2027-01-15T00:00:00Z") })];
    expect(countUpcomingHasEvaluations(rows, within)).toBe(1);
  });

  it("exclut l'échéance passée", () => {
    // Une évaluation déjà passée ne dit rien de ce qu'il reste à préparer.
    const rows = [row({ hasEvaluationTargetDate: new Date("2026-06-01T00:00:00Z") })];
    expect(countUpcomingHasEvaluations(rows, within)).toBe(0);
  });

  it("exclut l'échéance au-delà de l'horizon", () => {
    const rows = [row({ hasEvaluationTargetDate: new Date("2027-12-01T00:00:00Z") })];
    expect(countUpcomingHasEvaluations(rows, within)).toBe(0);
  });

  it("exclut l'échéance d'une mission close", () => {
    const rows = [
      row({
        mission: mission({ closedAt: NOW }),
        hasEvaluationTargetDate: new Date("2027-01-15T00:00:00Z"),
      }),
    ];
    expect(countUpcomingHasEvaluations(rows, within)).toBe(0);
  });

  it("ignore la fiche sans date d'échéance", () => {
    expect(countUpcomingHasEvaluations([row()], within)).toBe(0);
  });
});

describe("countUpcomingHasEvaluations — fiches sans mission ou démarrées", () => {
  const within = { now: NOW, withinDays: 180 };
  const target = new Date("2027-01-15T00:00:00Z");

  it("compte la mission démarrée autant que la fiche fraîchement signée", () => {
    const rows = [row({ hasEvaluationTargetDate: target }), row({ mission: mission({ completedChecklistCount: 2 }), hasEvaluationTargetDate: target })];
    expect(countUpcomingHasEvaluations(rows, within)).toBe(2);
  });

  it("exclut la fiche sans mission", () => {
    expect(countUpcomingHasEvaluations([row({ mission: null, hasEvaluationTargetDate: target })], within)).toBe(0);
  });
});
