import { describe, expect, it } from "vitest";
import type { BeneficiaryDocumentSummary, BeneficiaryTimeline } from "@/lib/hds/beneficiary-data-port";
import { computeBeneficiaryAggregates } from "./beneficiary-aggregate-service";

// Données SYNTHÉTIQUES : des identifiants et des dates, aucun nom — exactement ce que
// le service reçoit en production.
const TODAY = new Date("2026-10-14T09:00:00Z");

function timeline(id: string, startedOn: string, endedOn: string | null = null): BeneficiaryTimeline {
  return { id, startedOn: new Date(startedOn), endedOn: endedOn ? new Date(endedOn) : null };
}

function doc(beneficiaryId: string, kind: BeneficiaryDocumentSummary["kind"], issuedAt: string, renewDueOn: string | null = null): BeneficiaryDocumentSummary {
  return { id: `${beneficiaryId}-${kind}`, beneficiaryId, kind, issuedAt: new Date(issuedAt), renewDueOn: renewDueOn ? new Date(renewDueOn) : null, signedAt: null };
}

describe("computeBeneficiaryAggregates", () => {
  it("rend des zéros sans aucune donnée (verrou HDS fermé)", () => {
    expect(computeBeneficiaryAggregates({ timelines: [], documents: [], surveyedIds: new Set(), today: TODAY })).toEqual({
      activePeople: 0,
      receptionUpToDate: 0,
      receptionToRenew: 0,
      surveyDone: 0,
      alerts: { total: 0, overdue: 0, toDeliver: 0, toRenew: 0 },
    });
  });

  it("partage les personnes en cours entre « à jour » et « à remettre ou à renouveler »", () => {
    const result = computeBeneficiaryAggregates({
      timelines: [
        timeline("a", "2026-01-10"), // feuille remise, rien à revoir → à jour
        timeline("b", "2026-09-01"), // rien remis, délai de 15 jours dépassé → en retard
        timeline("c", "2025-10-20"), // DIPEC à revoir sous 30 jours
        timeline("d", "2025-01-01", "2026-06-30"), // accompagnement terminé : hors compte
      ],
      documents: [
        doc("a", "FEUILLE_RECEPTION", "2026-01-10"),
        doc("c", "DIPC", "2025-10-20", "2026-10-20"),
      ],
      surveyedIds: new Set(["a", "d"]),
      today: TODAY,
    });

    expect(result).toEqual({
      activePeople: 3,
      receptionUpToDate: 1,
      receptionToRenew: 2,
      surveyDone: 1,
      alerts: { total: 2, overdue: 1, toDeliver: 1, toRenew: 1 },
    });
  });

  it("compte une personne une seule fois même si plusieurs échéances la concernent", () => {
    const result = computeBeneficiaryAggregates({
      timelines: [timeline("a", "2025-10-01")],
      documents: [doc("a", "DIPC", "2025-10-01", "2026-10-01"), doc("a", "PAP", "2025-10-01", "2026-10-30")],
      surveyedIds: new Set(),
      today: TODAY,
    });
    expect(result.receptionToRenew).toBe(1);
    expect(result.alerts).toEqual({ total: 2, overdue: 1, toDeliver: 0, toRenew: 2 });
  });
});
