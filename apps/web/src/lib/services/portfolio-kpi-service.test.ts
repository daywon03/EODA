import { describe, expect, it } from "vitest";
import type { ProspectStatus } from "@eoda/database";
import type { MissionLifecycleFacts } from "./lifecycle-service";
import {
  computeFunnelBreakdown,
  countActiveBetaMissions,
  countActiveClients,
  countOngoingAccompaniments,
  countUpcomingHasEvaluations,
  groupActiveMissionsByFormule,
  type PortfolioRow,
} from "./portfolio-kpi-service";

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
    prospectStatus: "SIGNE",
    mission: mission(),
    missionFormule: "ESSENTIEL",
    hasEvaluationTargetDate: null,
    ...overrides,
  };
}

const NO_PROSPECTS: Record<ProspectStatus, number> = {
  NOUVEAU: 0,
  RDV: 0,
  DEVIS_ENVOYE: 0,
  NEGOCIATION: 0,
  SIGNE: 0,
  PERDU: 0,
};

describe("countActiveClients", () => {
  it("compte la fiche signée dont rien n'a encore démarré", () => {
    // Le client a payé : l'engagement court, même si aucun item n'est coché.
    expect(countActiveClients([row()])).toBe(1);
  });

  it("compte la fiche dont l'accompagnement est engagé", () => {
    expect(countActiveClients([row({ mission: mission({ completedChecklistCount: 1 }) })])).toBe(1);
  });

  it("exclut la mission close", () => {
    expect(countActiveClients([row({ mission: mission({ closedAt: NOW }) })])).toBe(0);
  });

  it("exclut la fiche sans mission — elle n'est pas un client actif", () => {
    expect(countActiveClients([row({ mission: null })])).toBe(0);
  });
});

describe("countOngoingAccompaniments", () => {
  it("ne compte que les missions démarrées, pas les fiches fraîchement signées", () => {
    // Confondre les deux ferait croire à une charge de travail qui n'existe pas.
    const rows = [row(), row({ mission: mission({ scheduledPhaseDateCount: 1 }) })];
    expect(countOngoingAccompaniments(rows)).toBe(1);
  });

  it("exclut la mission close, même entièrement cochée", () => {
    const closed = row({ mission: mission({ closedAt: NOW, completedChecklistCount: 12 }) });
    expect(countOngoingAccompaniments([closed])).toBe(0);
  });
});

describe("countActiveBetaMissions", () => {
  it("compte le bêta-test à toutes les étapes actives", () => {
    const rows = [
      row({ mission: mission({ gratuit: true }) }),
      row({ mission: mission({ gratuit: true, completedChecklistCount: 3 }) }),
    ];
    expect(countActiveBetaMissions(rows)).toBe(2);
  });

  it("exclut le bêta-test clos et les missions payantes", () => {
    const rows = [
      row({ mission: mission({ gratuit: true, closedAt: NOW }) }),
      row({ mission: mission({ gratuit: false }) }),
    ];
    expect(countActiveBetaMissions(rows)).toBe(0);
  });
});

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

describe("groupActiveMissionsByFormule", () => {
  it("répartit les missions actives par formule contractée", () => {
    const rows = [
      row({ missionFormule: "ESSENTIEL" }),
      row({ missionFormule: "EXCELLENCE", mission: mission({ completedChecklistCount: 2 }) }),
      row({ missionFormule: "EXCELLENCE" }),
    ];
    expect(groupActiveMissionsByFormule(rows)).toEqual({
      BETA: 0,
      ESSENTIEL: 1,
      PERFORMANCE: 0,
      EXCELLENCE: 2,
    });
  });

  it("exclut les missions closes et les fiches sans formule", () => {
    const rows = [
      row({ missionFormule: "PERFORMANCE", mission: mission({ closedAt: NOW }) }),
      row({ missionFormule: null }),
    ];
    expect(groupActiveMissionsByFormule(rows)).toEqual({
      BETA: 0,
      ESSENTIEL: 0,
      PERFORMANCE: 0,
      EXCELLENCE: 0,
    });
  });
});

describe("computeFunnelBreakdown", () => {
  it("projette prospects non convertis et fiches clients sur une seule échelle", () => {
    const breakdown = computeFunnelBreakdown({
      unconvertedProspectsByStatus: { ...NO_PROSPECTS, NOUVEAU: 2, NEGOCIATION: 1, PERDU: 3 },
      establishments: [
        row(),
        row({ mission: mission({ completedChecklistCount: 1 }) }),
        row({ mission: mission({ closedAt: NOW }) }),
      ],
    });

    expect(breakdown.byStage).toEqual({
      NOUVEAU: 2,
      RDV: 0,
      DEVIS_ENVOYE: 0,
      NEGOCIATION: 1,
      SIGNE: 1,
      EN_COURS: 1,
      TERMINE: 1,
      PERDU: 3,
    });
    expect(breakdown.indetermine).toBe(0);
  });

  it("ne compte pas deux fois une structure convertie", () => {
    // Le prospect converti garde `status = SIGNE` à vie ; c'est l'étape de sa
    // mission qui fait foi. L'appelant ne le charge pas, l'agrégat ne le rattrape
    // donc pas côté prospect.
    const breakdown = computeFunnelBreakdown({
      unconvertedProspectsByStatus: NO_PROSPECTS,
      establishments: [row({ prospectStatus: "SIGNE", mission: mission({ closedAt: NOW }) })],
    });

    expect(breakdown.byStage.SIGNE).toBe(0);
    expect(breakdown.byStage.TERMINE).toBe(1);
  });

  it("range à part la fiche sans prospect ni mission plutôt que d'inventer une étape", () => {
    const breakdown = computeFunnelBreakdown({
      unconvertedProspectsByStatus: NO_PROSPECTS,
      establishments: [row({ prospectStatus: null, mission: null })],
    });

    expect(breakdown.indetermine).toBe(1);
    expect(Object.values(breakdown.byStage).every((count) => count === 0)).toBe(true);
  });

  it("retombe sur le statut du prospect quand la mission n'existe pas encore", () => {
    const breakdown = computeFunnelBreakdown({
      unconvertedProspectsByStatus: NO_PROSPECTS,
      establishments: [row({ prospectStatus: "NEGOCIATION", mission: null })],
    });

    expect(breakdown.byStage.NEGOCIATION).toBe(1);
  });
});
