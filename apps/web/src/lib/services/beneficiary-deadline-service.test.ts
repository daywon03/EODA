import { describe, expect, it } from "vitest";
import type { BeneficiaryDocumentSummary, BeneficiarySummary } from "@/lib/hds/beneficiary-data-port";
import { addOneYear, deriveDeadlineAlerts, renewalDueOn } from "./beneficiary-deadline-service";

// Données SYNTHÉTIQUES.
const TODAY = new Date("2026-10-14T09:00:00Z");

function person(id: string, startedOn: string, endedOn: string | null = null): BeneficiarySummary {
  return {
    id,
    civility: null,
    firstName: "Prénom",
    lastName: `Fictif ${id}`,
    address: "Adresse fictive",
    girLevel: 3,
    monthlyHours: 10,
    startedOn: new Date(startedOn),
    endedOn: endedOn ? new Date(endedOn) : null,
    referentStaffMemberId: null,
    representative: null,
  };
}

function doc(beneficiaryId: string, kind: BeneficiaryDocumentSummary["kind"], issuedAt: string, renewDueOn: string | null): BeneficiaryDocumentSummary {
  return { id: `${beneficiaryId}-${kind}-${issuedAt}`, beneficiaryId, kind, issuedAt: new Date(issuedAt), renewDueOn: renewDueOn ? new Date(renewDueOn) : null, signedAt: null };
}

describe("renewalDueOn", () => {
  it("un an pour le DIPEC et le PAP, rien pour une feuille de réception", () => {
    expect(renewalDueOn("DIPC", new Date("2026-03-01T00:00:00Z"))?.toISOString()).toBe("2027-03-01T00:00:00.000Z");
    expect(renewalDueOn("PAP", new Date("2026-03-01T00:00:00Z"))).not.toBeNull();
    expect(renewalDueOn("FEUILLE_RECEPTION", TODAY)).toBeNull();
    expect(addOneYear(new Date("2024-02-29T00:00:00Z")).toISOString()).toBe("2025-03-01T00:00:00.000Z");
  });
});

describe("deriveDeadlineAlerts", () => {
  it("signale un DIPEC à remettre sous 15 jours, en retard ou non", () => {
    const alerts = deriveDeadlineAlerts([person("a", "2026-10-10"), person("b", "2026-09-01")], [], TODAY);
    expect(alerts.map((a) => [a.beneficiaryId, a.kind, a.overdue])).toEqual([
      ["b", "DIPC_A_REMETTRE", true],
      ["a", "DIPC_A_REMETTRE", false],
    ]);
  });

  it("ne réclame pas de DIPEC quand la feuille de réception est signée", () => {
    expect(deriveDeadlineAlerts([person("a", "2026-10-10")], [doc("a", "FEUILLE_RECEPTION", "2026-10-11", null)], TODAY)).toEqual([]);
  });

  it("alerte 30 jours avant le renouvellement annuel, sur la DERNIÈRE version seulement", () => {
    const docs = [
      doc("a", "FEUILLE_RECEPTION", "2025-10-01", null),
      doc("a", "PAP", "2025-11-01", "2026-11-01"),
      doc("a", "DIPC", "2024-10-01", "2025-10-01"),
      doc("a", "DIPC", "2025-12-30", "2026-12-30"),
    ];
    const alerts = deriveDeadlineAlerts([person("a", "2025-09-20")], docs, TODAY);
    expect(alerts.map((a) => [a.documentKind, a.overdue])).toEqual([["PAP", false]]);
  });

  it("ignore une personne dont l'accompagnement est terminé", () => {
    expect(deriveDeadlineAlerts([person("a", "2026-01-01", "2026-06-01")], [], TODAY)).toEqual([]);
  });
});
