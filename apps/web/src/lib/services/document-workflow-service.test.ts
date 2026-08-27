import { describe, expect, it } from "vitest";
import {
  canDeleteVersion,
  countByStep,
  deriveDocumentStep,
  describeNextStep,
  isStepReached,
  type DocumentWorkflowFacts,
} from "./document-workflow-service";

function facts(overrides: Partial<DocumentWorkflowFacts> = {}): DocumentWorkflowFacts {
  return {
    hasVersion: false,
    hasAnalysis: false,
    hasCabinetVersion: false,
    analysisRestituted: false,
    validatedAt: null,
    ...overrides,
  };
}

describe("deriveDocumentStep", () => {
  it("part de « attendu » tant que rien n'est déposé", () => {
    expect(deriveDocumentStep(facts())).toBe("ATTENDU");
  });

  it("passe à « déposé » dès qu'une version existe", () => {
    expect(deriveDocumentStep(facts({ hasVersion: true }))).toBe("DEPOSE");
  });

  it("passe à « analysé » quand l'analyse a abouti", () => {
    expect(deriveDocumentStep(facts({ hasVersion: true, hasAnalysis: true }))).toBe("ANALYSE");
  });

  it("distingue « mis en conformité » d'« analysé » par la version produite par le cabinet", () => {
    // C'est le travail de correction qui fait la différence, pas la lecture.
    expect(
      deriveDocumentStep(facts({ hasVersion: true, hasAnalysis: true, hasCabinetVersion: true }))
    ).toBe("MIS_EN_CONFORMITE");
  });

  it("passe à « restitué » une fois l'analyse relue et rendue visible", () => {
    expect(
      deriveDocumentStep(
        facts({ hasVersion: true, hasAnalysis: true, hasCabinetVersion: true, analysisRestituted: true })
      )
    ).toBe("RESTITUE");
  });

  it("rend « validé » dès que la décision est posée, quel que soit le reste", () => {
    // La validation est une décision humaine : elle l'emporte sur la dérivation.
    expect(deriveDocumentStep(facts({ validatedAt: new Date("2026-09-01") }))).toBe("VALIDE");
  });
});

describe("isStepReached", () => {
  it("considère les étapes précédentes comme franchies", () => {
    // Un document validé a forcément été déposé.
    expect(isStepReached("VALIDE", "DEPOSE")).toBe(true);
    expect(isStepReached("DEPOSE", "VALIDE")).toBe(false);
  });
});

describe("describeNextStep", () => {
  it("dit quoi faire, pas seulement où on en est", () => {
    expect(describeNextStep("ANALYSE")).toContain("mettre en conformité");
    expect(describeNextStep("RESTITUE")).toContain("valider");
  });

  it("ne réclame rien sur un document validé", () => {
    expect(describeNextStep("VALIDE")).toContain("rien à faire");
  });
});

describe("countByStep", () => {
  it("compte de façon cumulative", () => {
    // Un décompte non cumulatif ferait chuter « analysés » à mesure que le travail
    // avance — ce qui se lit comme une régression.
    const counters = countByStep(["ATTENDU", "DEPOSE", "ANALYSE", "VALIDE"]);

    expect(counters.ATTENDU).toBe(4);
    expect(counters.DEPOSE).toBe(3);
    expect(counters.ANALYSE).toBe(2);
    expect(counters.MIS_EN_CONFORMITE).toBe(1);
    expect(counters.VALIDE).toBe(1);
  });

  it("rend des compteurs à zéro sur une checklist vide", () => {
    expect(countByStep([])).toEqual({
      ATTENDU: 0,
      DEPOSE: 0,
      ANALYSE: 0,
      MIS_EN_CONFORMITE: 0,
      RESTITUE: 0,
      VALIDE: 0,
    });
  });
});

describe("canDeleteVersion", () => {
  it("laisse le cabinet retirer sa propre dernière version", () => {
    expect(
      canDeleteVersion({ actorIsCabinet: true, versionProducedByCabinet: true, isLatest: true })
    ).toBe(true);
  });

  it("interdit au cabinet d'effacer un document déposé par le client", () => {
    // « Moi, je prends ce qu'ils me donnent » — c'est un risque juridique autant
    // qu'une mauvaise manip.
    expect(
      canDeleteVersion({ actorIsCabinet: true, versionProducedByCabinet: false, isLatest: true })
    ).toBe(false);
  });

  it("laisse le client corriger son propre dépôt", () => {
    expect(
      canDeleteVersion({ actorIsCabinet: false, versionProducedByCabinet: false, isLatest: true })
    ).toBe(true);
  });

  it("interdit au client de toucher à une version produite par le cabinet", () => {
    expect(
      canDeleteVersion({ actorIsCabinet: false, versionProducedByCabinet: true, isLatest: true })
    ).toBe(false);
  });

  it("n'autorise jamais la suppression d'une version antérieure", () => {
    // Au-delà de la dernière, ce n'est plus une correction : c'est une réécriture de
    // l'historique.
    expect(
      canDeleteVersion({ actorIsCabinet: true, versionProducedByCabinet: true, isLatest: false })
    ).toBe(false);
  });
});
