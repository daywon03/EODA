import { describe, expect, it } from "vitest";
import {
  countDeliverablesInProgress,
  groupDeliverablesByCategory,
  selectDeliverables,
  type DeliverableSourceItem,
  type DeliverableSourceVersion,
} from "./deliverables-service";

function version(overrides: Partial<DeliverableSourceVersion> = {}): DeliverableSourceVersion {
  return {
    id: "v1",
    versionNumber: 1,
    originalFilename: "piece.pdf",
    uploadedAt: new Date("2026-08-01T10:00:00Z"),
    producedByCabinet: false,
    ...overrides,
  };
}

function item(overrides: Partial<DeliverableSourceItem> = {}): DeliverableSourceItem {
  return {
    code: "L2002_LIVRET_ACCUEIL",
    label: "Livret d'accueil",
    category: "LOI_2002_2",
    step: "VALIDE",
    versions: [version()],
    ...overrides,
  };
}

describe("selectDeliverables", () => {
  it("ne remet qu'un document VALIDÉ — valider engage la parole de l'évaluatrice", () => {
    const versions = [version(), version({ id: "v2", versionNumber: 2, producedByCabinet: true })];
    expect(selectDeliverables([item({ step: "RELU", versions })])).toEqual([]);
    expect(selectDeliverables([item({ step: "VALIDE", versions })])).toHaveLength(1);
  });

  it("ne compte pas comme livrable un document validé sans production d'EODA", () => {
    // La pièce du client était conforme telle quelle : EODA n'a rien remis.
    expect(selectDeliverables([item({ versions: [version()] })])).toEqual([]);
  });

  it("remet la dernière version PRODUITE PAR EODA, pas la dernière tout court", () => {
    const deliverables = selectDeliverables([
      item({
        versions: [
          version({ id: "v1", versionNumber: 1, producedByCabinet: false }),
          version({ id: "v2", versionNumber: 2, producedByCabinet: true }),
          version({ id: "v3", versionNumber: 3, producedByCabinet: false }),
        ],
      }),
    ]);
    expect(deliverables[0]?.documentVersionId).toBe("v2");
  });

  it("classe du plus récemment remis au plus ancien", () => {
    const produced = (id: string, day: string) =>
      version({ id, versionNumber: 2, producedByCabinet: true, uploadedAt: new Date(day) });
    const deliverables = selectDeliverables([
      item({ code: "A", versions: [produced("a", "2026-07-01")] }),
      item({ code: "B", versions: [produced("b", "2026-08-15")] }),
    ]);
    expect(deliverables.map((d) => d.code)).toEqual(["B", "A"]);
  });
});

describe("countDeliverablesInProgress", () => {
  it("compte ce qu'EODA a produit et pas encore validé", () => {
    const produced = [version({ id: "v2", versionNumber: 2, producedByCabinet: true })];
    expect(
      countDeliverablesInProgress([
        item({ code: "A", step: "MODIFIE", versions: produced }),
        item({ code: "B", step: "VALIDE", versions: produced }),
        item({ code: "C", step: "DEPOSE", versions: [version()] }),
      ])
    ).toBe(1);
  });
});

describe("groupDeliverablesByCategory", () => {
  it("regroupe par catégorie en conservant l'ordre reçu", () => {
    const deliverables = selectDeliverables([
      item({
        code: "A",
        category: "LOI_2002_2",
        versions: [version({ id: "a", producedByCabinet: true })],
      }),
      item({
        code: "B",
        category: "RH",
        versions: [version({ id: "b", producedByCabinet: true })],
      }),
    ]);
    const grouped = groupDeliverablesByCategory(deliverables);
    expect([...grouped.keys()].sort()).toEqual(["LOI_2002_2", "RH"]);
  });
});
