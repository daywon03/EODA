import { describe, expect, it } from "vitest";
import {
  countDeliverablesInProgress,
  countNewDeliverables,
  groupDeliverablesByCategory,
  isNewDeliverable,
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
    validatedAt: null,
    versions: [version()],
    ...overrides,
  };
}

function cabinetVersion(uploadedAt: string): DeliverableSourceVersion {
  return version({ id: "v2", versionNumber: 2, producedByCabinet: true, uploadedAt: new Date(uploadedAt) });
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

  it("date la remise au jour de la VALIDATION quand elle suit le dépôt", () => {
    // Déposé le 3, validé le 10 : le client le reçoit le 10.
    const [deliverable] = selectDeliverables([
      item({ validatedAt: new Date("2026-09-10T09:00:00Z"), versions: [cabinetVersion("2026-09-03T09:00:00Z")] }),
    ]);
    expect(deliverable?.remittedOn).toEqual(new Date("2026-09-10T09:00:00Z"));
  });

  it("date la remise au jour du DÉPÔT quand une nouvelle version arrive sur un document déjà validé", () => {
    const [deliverable] = selectDeliverables([
      item({ validatedAt: new Date("2026-09-10T09:00:00Z"), versions: [cabinetVersion("2026-09-20T09:00:00Z")] }),
    ]);
    expect(deliverable?.remittedOn).toEqual(new Date("2026-09-20T09:00:00Z"));
  });
});

describe("isNewDeliverable / countNewDeliverables", () => {
  const deliverables = selectDeliverables([
    item({ code: "A", validatedAt: new Date("2026-09-05T09:00:00Z"), versions: [cabinetVersion("2026-09-01T09:00:00Z")] }),
    item({ code: "B", validatedAt: new Date("2026-09-15T09:00:00Z"), versions: [cabinetVersion("2026-09-01T09:00:00Z")] }),
  ]);

  it("annonce comme nouveau ce qui a été remis après la dernière ouverture de la page", () => {
    const seenAt = new Date("2026-09-10T09:00:00Z");
    expect(deliverables.filter((d) => isNewDeliverable(d, seenAt)).map((d) => d.code)).toEqual(["B"]);
    expect(countNewDeliverables(deliverables, seenAt)).toBe(1);
  });

  it("annonce tout comme nouveau tant que la page n'a jamais été ouverte", () => {
    expect(countNewDeliverables(deliverables, null)).toBe(2);
  });

  it("n'annonce plus rien une fois la page ouverte après la dernière remise", () => {
    expect(countNewDeliverables(deliverables, new Date("2026-09-20T09:00:00Z"))).toBe(0);
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
