import { describe, expect, it } from "vitest";
import {
  computeMissionDocumentCounters,
  type MissionDocumentSnapshot,
} from "./mission-document-counters-service";

// Les quatre compteurs dictés au call du 16/08/2026 —
// .claude/context/07-outil-pilotage-missions.md §12.4.

function doc(overrides: Partial<MissionDocumentSnapshot> = {}): MissionDocumentSnapshot {
  return {
    status: "MISSING",
    versionCount: 0,
    hasAnalyzedVersion: false,
    hasRegeneratedVersion: false,
    ...overrides,
  };
}

describe("computeMissionDocumentCounters — §12.4", () => {
  it("renvoie quatre zéros sur un établissement sans aucun document", () => {
    expect(computeMissionDocumentCounters([])).toEqual({
      deposited: 0,
      analyzed: 0,
      modified: 0,
      compliant: 0,
    });
  });

  it("ne compte comme déposé qu'un document qui porte au moins une version", () => {
    const counters = computeMissionDocumentCounters([
      doc({ versionCount: 1, status: "UPLOADED" }),
      doc({ versionCount: 0, status: "MISSING" }),
    ]);
    expect(counters.deposited).toBe(1);
  });

  it("compte comme analysé le document dont une version porte un résultat d'analyse", () => {
    const counters = computeMissionDocumentCounters([
      doc({ versionCount: 1, hasAnalyzedVersion: true, status: "INCOMPLETE" }),
      doc({ versionCount: 1, hasAnalyzedVersion: false, status: "UPLOADED" }),
    ]);
    expect(counters.analyzed).toBe(1);
  });

  it("compte comme modifié un redépôt (2 versions) comme une régénération", () => {
    const counters = computeMissionDocumentCounters([
      doc({ versionCount: 2, status: "UPLOADED" }),
      doc({ versionCount: 1, hasRegeneratedVersion: true, status: "UPLOADED" }),
      doc({ versionCount: 1, status: "UPLOADED" }),
    ]);
    expect(counters.modified).toBe(2);
  });

  it("compte comme conforme le seul statut COMPLIANT", () => {
    const counters = computeMissionDocumentCounters([
      doc({ versionCount: 1, status: "COMPLIANT" }),
      doc({ versionCount: 1, status: "EXPIRED" }),
      doc({ versionCount: 1, status: "ANALYZING" }),
    ]);
    expect(counters.compliant).toBe(1);
  });

  it("refuse de compter conforme ou analysé un document jamais déposé", () => {
    // Cas de refus : un statut résiduel en base ne doit pas gonfler les compteurs
    // d'un document que le client n'a jamais fourni.
    const counters = computeMissionDocumentCounters([
      doc({ versionCount: 0, status: "COMPLIANT", hasAnalyzedVersion: true }),
    ]);
    expect(counters).toEqual({ deposited: 0, analyzed: 0, modified: 0, compliant: 0 });
  });

  it("ne compte jamais NOT_APPLICABLE comme conforme", () => {
    const counters = computeMissionDocumentCounters([
      doc({ versionCount: 1, status: "NOT_APPLICABLE" }),
    ]);
    expect(counters).toMatchObject({ deposited: 1, compliant: 0 });
  });
});
