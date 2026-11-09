import { describe, expect, it } from "vitest";
import {
  computeMissionDocumentCounters,
  countComplianceDocuments,
  missionDocumentCounterHint,
  validatedCounterLabel,
  type ExpectedDocumentFacts,
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
    validatedAt: null,
    clientAcceptedAt: null,
    currentVersionUploadedAt: null,
    currentVersionByCabinet: false,
    ...overrides,
  };
}

describe("computeMissionDocumentCounters — §12.4", () => {
  it("renvoie quatre zéros sur un établissement sans aucun document", () => {
    expect(computeMissionDocumentCounters([], "ACCOMPAGNE")).toEqual({
      deposited: 0,
      analyzed: 0,
      modified: 0,
      validated: 0,
    });
  });

  it("ne compte comme déposé qu'un document qui porte au moins une version", () => {
    const counters = computeMissionDocumentCounters(
      [
        doc({ versionCount: 1, status: "UPLOADED" }),
        doc({ versionCount: 0, status: "MISSING" }),
      ],
      "ACCOMPAGNE"
    );
    expect(counters.deposited).toBe(1);
  });

  it("compte comme analysé le document dont une version porte un résultat d'analyse", () => {
    const counters = computeMissionDocumentCounters(
      [
        doc({ versionCount: 1, hasAnalyzedVersion: true, status: "INCOMPLETE" }),
        doc({ versionCount: 1, hasAnalyzedVersion: false, status: "UPLOADED" }),
      ],
      "ACCOMPAGNE"
    );
    expect(counters.analyzed).toBe(1);
  });

  it("compte comme modifié un redépôt (2 versions) comme une régénération", () => {
    const counters = computeMissionDocumentCounters(
      [
        doc({ versionCount: 2, status: "UPLOADED" }),
        doc({ versionCount: 1, hasRegeneratedVersion: true, status: "UPLOADED" }),
        doc({ versionCount: 1, status: "UPLOADED" }),
      ],
      "ACCOMPAGNE"
    );
    expect(counters.modified).toBe(2);
  });

  // 08/11/2026 — Sandrine : « 0 Conformes » sur une structure aux documents validés.
  // Le compteur lisait le statut COMPLIANT, que pose l'IA quand elle ne trouve aucun
  // manque — presque jamais. Il compte désormais ce qu'EODA a VALIDÉ (accompagné) ou
  // ce que la structure a ACCEPTÉ (autonomie) : la règle de isDocumentProven.
  const upload = new Date("2026-10-01T10:00:00Z");
  const after = new Date("2026-10-05T10:00:00Z");
  const before = new Date("2026-09-20T10:00:00Z");

  it("compte comme validé un document validé par EODA après sa version courante, quel que soit le statut", () => {
    const counters = computeMissionDocumentCounters(
      [
        doc({ versionCount: 1, status: "INCOMPLETE", currentVersionUploadedAt: upload, validatedAt: after }),
        doc({ versionCount: 1, status: "UPLOADED", currentVersionUploadedAt: upload }),
      ],
      "ACCOMPAGNE"
    );
    expect(counters.validated).toBe(1);
  });

  it("ne compte plus jamais le statut COMPLIANT posé par l'IA", () => {
    const counters = computeMissionDocumentCounters(
      [doc({ versionCount: 1, status: "COMPLIANT", currentVersionUploadedAt: upload })],
      "ACCOMPAGNE"
    );
    expect(counters.validated).toBe(0);
  });

  it("ne compte pas une validation antérieure à un redépôt de la structure", () => {
    const counters = computeMissionDocumentCounters(
      [doc({ versionCount: 2, status: "UPLOADED", currentVersionUploadedAt: upload, validatedAt: before })],
      "ACCOMPAGNE"
    );
    expect(counters.validated).toBe(0);
  });

  it("compte une version déposée par EODA sur un document déjà validé (livrable sur-le-champ)", () => {
    const counters = computeMissionDocumentCounters(
      [
        doc({
          versionCount: 2,
          status: "UPLOADED",
          currentVersionUploadedAt: upload,
          validatedAt: before,
          currentVersionByCabinet: true,
        }),
      ],
      "ACCOMPAGNE"
    );
    expect(counters.validated).toBe(1);
  });

  it("en autonomie, compte ce que la structure a accepté, pas une validation d'EODA", () => {
    const counters = computeMissionDocumentCounters(
      [
        doc({ versionCount: 1, status: "UPLOADED", currentVersionUploadedAt: upload, clientAcceptedAt: after }),
        doc({ versionCount: 1, status: "UPLOADED", currentVersionUploadedAt: upload, validatedAt: after }),
      ],
      "AUTONOMIE"
    );
    expect(counters.validated).toBe(1);
  });

  it("refuse de compter validé ou analysé un document jamais déposé", () => {
    const counters = computeMissionDocumentCounters(
      [doc({ versionCount: 0, status: "COMPLIANT", hasAnalyzedVersion: true, validatedAt: after })],
      "ACCOMPAGNE"
    );
    expect(counters).toEqual({ deposited: 0, analyzed: 0, modified: 0, validated: 0 });
  });

  it("ne compte jamais NOT_APPLICABLE comme validé", () => {
    const counters = computeMissionDocumentCounters(
      [doc({ versionCount: 1, status: "NOT_APPLICABLE", currentVersionUploadedAt: upload, validatedAt: after })],
      "ACCOMPAGNE"
    );
    expect(counters).toMatchObject({ deposited: 1, validated: 0 });
  });
});

describe("validatedCounterLabel — jamais « conforme »", () => {
  it("dit qui a validé, selon le mode", () => {
    expect(validatedCounterLabel("ACCOMPAGNE")).toBe("Validés par EODA");
    expect(validatedCounterLabel("AUTONOMIE")).toBe("Acceptés par la structure");
  });

  it("parle à la structure à la deuxième personne", () => {
    expect(validatedCounterLabel("AUTONOMIE", "CLIENT")).toBe("Acceptés par vous");
    expect(validatedCounterLabel("ACCOMPAGNE", "CLIENT")).toBe("Validés par EODA");
  });

  it("n'emploie jamais le mot « conforme » (CLAUDE.md §7)", () => {
    for (const mode of ["ACCOMPAGNE", "AUTONOMIE"] as const) {
      for (const audience of ["CABINET", "CLIENT"] as const) {
        expect(validatedCounterLabel(mode, audience).toLowerCase()).not.toContain("conforme");
      }
    }
  });
});

<<<<<<< HEAD
// Retour de Sandrine (call du 09/11/2026) : « ce qui doit refléter l'avancement, ce
// sont les documents validés / prouvés, pas des cases cochées ». L'étape « Mise en
// conformité » compte les documents ATTENDUS par l'offre qui sont PROUVÉS.
describe("countComplianceDocuments — documents attendus prouvés", () => {
  const validated = {
    status: "UPLOADED" as const,
    statusOverriddenByUser: false,
    validatedAt: new Date("2026-10-02"),
    clientAcceptedAt: null,
    currentVersionUploadedAt: new Date("2026-10-01"),
    currentVersionByCabinet: false,
  };
  const notConcerned = { ...validated, status: "NOT_APPLICABLE" as const, currentVersionUploadedAt: null, validatedAt: null };
  const row = (over: Partial<ExpectedDocumentFacts> = {}): ExpectedDocumentFacts => ({
    category: "QUALITE_RISQUES",
    code: "PROCEDURE_X",
    isConditional: false,
    document: null,
    ...over,
  });

  it("un type sans document est attendu, non prouvé", () => {
    expect(countComplianceDocuments([row()], "ACCOMPAGNE")).toEqual({ proven: 0, expected: 1, mode: "ACCOMPAGNE" });
  });

  it("prouvé = isDocumentProven : validé par EODA après la version courante", () => {
    const result = countComplianceDocuments(
      [row({ document: validated }), row({ document: { ...validated, validatedAt: new Date("2026-09-30") } }), row()],
      "ACCOMPAGNE"
    );
    expect(result).toMatchObject({ proven: 1, expected: 3 });
  });

  it("en autonomie, prouvé = accepté par la structure", () => {
    const accepted = { ...validated, validatedAt: null, clientAcceptedAt: new Date("2026-10-03") };
    expect(countComplianceDocuments([row({ document: accepted }), row({ document: validated })], "AUTONOMIE")).toMatchObject({
      proven: 1,
      expected: 2,
    });
  });

  it("« Non concerné » et un type conditionnel sans document sortent du total", () => {
    const result = countComplianceDocuments(
      [row({ isConditional: true }), row({ document: notConcerned }), row()],
      "ACCOMPAGNE"
    );
    expect(result).toMatchObject({ proven: 0, expected: 1 });
  });

  it("un ancien « Non » sur la loi 2002-2 se relit « je ne l'ai pas » : il reste attendu", () => {
    const result = countComplianceDocuments(
      [row({ category: "LOI_2002_2", code: "L2002_LIVRET_ACCUEIL", document: notConcerned })],
      "ACCOMPAGNE"
    );
    expect(result).toMatchObject({ proven: 0, expected: 1 });
  });
});

// Retour du 09/11/2026 (#12) : « Documents du portail client » montrait quatre nombres
// sans dire ce qu'ils comptent. Une ligne sous chaque compteur, écrite ici pour qu'elle
// suive la règle de calcul ci-dessus et non un texte posé à la main dans le composant.
describe("missionDocumentCounterHint", () => {
  it("dit ce que compte chacun des quatre compteurs", () => {
    expect(missionDocumentCounterHint("deposited", "ACCOMPAGNE")).toBe("Au moins une version déposée.");
    expect(missionDocumentCounterHint("analyzed", "ACCOMPAGNE")).toBe("Au moins une version analysée.");
    expect(missionDocumentCounterHint("modified", "ACCOMPAGNE")).toBe(
      "Une version régénérée, ou plus d'une version déposée."
    );
    expect(missionDocumentCounterHint("validated", "ACCOMPAGNE")).toBe(
      "Validation d'EODA à jour : aucune version plus récente à relire."
    );
  });

  it("en autonomie, le dernier compteur parle de l'acceptation de la structure, jamais d'EODA", () => {
    const hint = missionDocumentCounterHint("validated", "AUTONOMIE");
    expect(hint).toBe("Acceptation de la structure à jour : aucune version plus récente à relire.");
    expect(hint).not.toContain("EODA");
  });

  it("n'emploie jamais le mot « conforme » (CLAUDE.md §7)", () => {
    for (const key of ["deposited", "analyzed", "modified", "validated"] as const) {
      for (const mode of ["ACCOMPAGNE", "AUTONOMIE"] as const) {
        expect(missionDocumentCounterHint(key, mode).toLowerCase()).not.toContain("conforme");
      }
    }
  });
});
