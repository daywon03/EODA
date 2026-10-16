import { describe, expect, it } from "vitest";
import {
  OPAQUE_EXISTING_ACCOUNT_MESSAGE,
  decideExistingAccount,
  describeExistingAccount,
  type ExistingAccountFacts,
} from "./existing-account-service";

const TARGET = { establishmentId: "etab-cible", tenantId: "t-1" };

function account(overrides: Partial<ExistingAccountFacts> = {}): ExistingAccountFacts {
  return {
    role: "CLIENT_USER",
    isActive: true,
    tenantId: null,
    links: [{ establishmentId: "etab-a", establishmentName: "SAD Les Glycines (fictif)", tenantId: "t-1" }],
    ...overrides,
  };
}

describe("decideExistingAccount", () => {
  it("aucun compte : rien à dire", () => {
    expect(decideExistingAccount(null, TARGET)).toEqual({ kind: "NONE" });
    expect(describeExistingAccount({ kind: "NONE" })).toBeNull();
  });

  it("compte du même cabinet : dit où, et propose le rattachement", () => {
    const decision = decideExistingAccount(
      account({
        links: [
          { establishmentId: "etab-b", establishmentName: "SAD Les Tilleuls (fictif)", tenantId: "t-1" },
          { establishmentId: "etab-a", establishmentName: "SAD Les Glycines (fictif)", tenantId: "t-1" },
        ],
      }),
      TARGET
    );
    expect(decision).toEqual({
      kind: "LINKABLE",
      establishmentNames: ["SAD Les Glycines (fictif)", "SAD Les Tilleuls (fictif)"],
    });
    expect(describeExistingAccount(decision)).toContain("SAD Les Glycines (fictif), SAD Les Tilleuls (fictif)");
  });

  it("un seul rattachement dans un AUTRE cabinet suffit à rester opaque (pas d'oracle)", () => {
    const decision = decideExistingAccount(
      account({
        links: [
          { establishmentId: "etab-a", establishmentName: "SAD Les Glycines (fictif)", tenantId: "t-1" },
          { establishmentId: "etab-x", establishmentName: "Structure d'un autre cabinet", tenantId: "t-2" },
        ],
      }),
      TARGET
    );
    expect(decision).toEqual({ kind: "OPAQUE" });
    expect(describeExistingAccount(decision)).toBe(OPAQUE_EXISTING_ACCOUNT_MESSAGE);
  });

  it("compte sans rattachement (tenant inconnu) : opaque — fail-closed", () => {
    expect(decideExistingAccount(account({ links: [] }), TARGET)).toEqual({ kind: "OPAQUE" });
  });

  // Bug 7b du test de bout en bout : le compte client du seed n'avait ni tenant ni
  // structure, donc restait opaque pour TOUS les cabinets — inutilisable. Une fiche ne
  // naît que d'une signature : le compte ne peut pas avoir de structure d'avance, mais
  // son appartenance au cabinet suffit à le rendre rattachable.
  it("compte sans structure mais du MÊME cabinet : rattachable", () => {
    const decision = decideExistingAccount(account({ links: [], tenantId: "t-1" }), TARGET);
    expect(decision).toEqual({ kind: "LINKABLE", establishmentNames: [] });
    expect(describeExistingAccount(decision)).toBe(
      "Un compte existe déjà pour cette adresse, sans structure rattachée. " +
        "Vous pouvez le rattacher à cette structure."
    );
  });

  it("compte sans structure d'un AUTRE cabinet : opaque", () => {
    expect(decideExistingAccount(account({ links: [], tenantId: "t-2" }), TARGET)).toEqual({ kind: "OPAQUE" });
  });

  it("compte déclaré dans un autre cabinet : opaque même si ses rattachements semblent d'ici", () => {
    expect(decideExistingAccount(account({ tenantId: "t-2" }), TARGET)).toEqual({ kind: "OPAQUE" });
  });

  it("compte sans structure et désactivé, du même cabinet : à réactiver, pas à rattacher", () => {
    const decision = decideExistingAccount(account({ links: [], tenantId: "t-1", isActive: false }), TARGET);
    expect(decision).toEqual({ kind: "INACTIVE", establishmentNames: [] });
  });

  it("compte Cabinet : opaque, jamais rattachable à une structure", () => {
    expect(decideExistingAccount(account({ role: "CABINET_ADMIN" }), TARGET)).toEqual({ kind: "OPAQUE" });
  });

  it("déjà rattaché à la structure visée", () => {
    const decision = decideExistingAccount(
      account({ links: [{ establishmentId: "etab-cible", establishmentName: "X", tenantId: "t-1" }] }),
      TARGET
    );
    expect(decision).toEqual({ kind: "ALREADY_LINKED" });
    expect(describeExistingAccount(decision)).toContain("déjà accès");
  });

  it("compte désactivé : dit où le réactiver, ne propose pas de rattacher", () => {
    const decision = decideExistingAccount(account({ isActive: false }), TARGET);
    expect(decision.kind).toBe("INACTIVE");
    expect(describeExistingAccount(decision)).toContain("Réactivez-le");
  });
});
