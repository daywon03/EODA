import { describe, expect, it, vi } from "vitest";
import {
  sadMixteCriterionUpsertArgs,
  seedClientUserUpsertArgs,
  seedSadMixteCriteria,
  withRequestedFromClient,
} from "@eoda/database/seed-steps";
import { SAD_MIXTE_CRITERIA, SEED_TENANT_ID } from "@eoda/database/seed-data";

// Bug 7 du test de bout en bout (12/10/2026) : une base neuve, une fois seedée,
// n'avait aucun document réclamé, un compte client inutilisable et aucun critère
// SAD mixte. Ces tests portent sur ce que le seed ÉCRIT, sans jamais l'exécuter
// contre une base.

describe("withRequestedFromClient", () => {
  it("réclame les documents de la loi 2002-2 décidés", () => {
    expect(withRequestedFromClient({ code: "L2002_LIVRET_ACCUEIL" }).requestedFromClient).toBe(true);
    expect(withRequestedFromClient({ code: "L2002_PERSONNES_QUALIFIEES" }).requestedFromClient).toBe(true);
  });

  it("ne réclame pas un document que le cabinet produit", () => {
    expect(withRequestedFromClient({ code: "P13_TABLEAU_SUIVI", label: "x" })).toEqual({
      code: "P13_TABLEAU_SUIVI",
      label: "x",
      requestedFromClient: false,
    });
  });
});

describe("seedClientUserUpsertArgs", () => {
  const rotation = { mustChangePassword: false, passwordChangedAt: new Date(0) };

  it("pose le tenant du seed à la création ET à la mise à jour (bases seedées avant le correctif)", () => {
    const args = seedClientUserUpsertArgs("hash", rotation);
    expect(args.create.tenantId).toBe(SEED_TENANT_ID);
    expect(args.update.tenantId).toBe(SEED_TENANT_ID);
    expect(args.create.role).toBe("CLIENT_USER");
  });

  it("ne crée aucune structure : une fiche ne naît que d'une signature", () => {
    expect(JSON.stringify(seedClientUserUpsertArgs("hash", rotation))).not.toMatch(/establishment/i);
  });
});

describe("seedSadMixteCriteria", () => {
  it("charge les 15 critères, rattachés à leur objectif, sans jamais modifier un critère existant", async () => {
    const upsertCriterion = vi.fn().mockResolvedValue(undefined);
    const findObjectiveId = vi.fn(async (chapter: number, code: string) => `obj-${chapter}-${code}`);

    const result = await seedSadMixteCriteria({ findObjectiveId, upsertCriterion });

    expect(result.seeded).toHaveLength(15);
    expect(result.skipped).toEqual([]);
    expect(findObjectiveId).toHaveBeenCalledWith(3, "3.6");
    const imperatif = upsertCriterion.mock.calls
      .map(([args]) => args)
      .find((args) => args.where.code === "3.6.2");
    expect(imperatif).toEqual({
      where: { code: "3.6.2" },
      update: {},
      create: expect.objectContaining({
        id: "crit-sad-mixte-3-6-2",
        objectiveId: "obj-3-3.6",
        requirementLevel: "IMPERATIF",
        applicableTo: "SAD_MIXTE",
      }),
    });
  });

  it("saute un critère dont l'objectif n'est pas chargé (grilles absentes), sans rien écrire", async () => {
    const upsertCriterion = vi.fn();
    const result = await seedSadMixteCriteria({
      findObjectiveId: async () => null,
      upsertCriterion,
    });
    expect(result.seeded).toEqual([]);
    expect(result.skipped).toEqual(SAD_MIXTE_CRITERIA.map((c) => c.code));
    expect(upsertCriterion).not.toHaveBeenCalled();
  });

  it("arguments d'upsert : idempotents (clé = code, mise à jour vide)", () => {
    const args = sadMixteCriterionUpsertArgs(SAD_MIXTE_CRITERIA[0]!, "obj-1");
    expect(args.where).toEqual({ code: "1.15.1" });
    expect(args.update).toEqual({});
  });
});
