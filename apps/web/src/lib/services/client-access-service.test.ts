import { describe, expect, it } from "vitest";
import {
  clientPermissionMatrix,
  countActiveDirections,
  decideClientAccessRevocation,
  decideClientRoleChange,
  deriveAccessStatus,
  parseClientAccessRole,
} from "./client-access-service";

const DIRECTION = { userId: "d1", accessRole: "DIRECTION" as const, revokedAt: null };
const RQ = { userId: "r1", accessRole: "RESPONSABLE_QUALITE" as const, revokedAt: null };

describe("directions actives", () => {
  it("ne compte que les directions dont l'accès n'est pas retiré", () => {
    expect(countActiveDirections([DIRECTION, { ...DIRECTION, userId: "d2", revokedAt: new Date() }, RQ])).toBe(1);
  });
});

describe("changer un rôle d'accès", () => {
  it("permis sur une autre personne", () => {
    expect(decideClientRoleChange({ actorId: "d1", target: RQ, newRole: "INTERVENANT", activeDirectionCount: 1 })).toEqual({ ok: true });
  });
  it("jamais son propre rôle", () => {
    expect(
      decideClientRoleChange({ actorId: "d1", target: DIRECTION, newRole: "INTERVENANT", activeDirectionCount: 2 })
    ).toMatchObject({ ok: false });
  });
  it("jamais la dernière direction", () => {
    expect(
      decideClientRoleChange({ actorId: "x", target: DIRECTION, newRole: "INTERVENANT", activeDirectionCount: 1 })
    ).toMatchObject({ ok: false, error: expect.stringContaining("direction") });
  });
  it("pas sur un accès retiré", () => {
    expect(
      decideClientRoleChange({ actorId: "d1", target: { ...RQ, revokedAt: new Date() }, newRole: "DIRECTION", activeDirectionCount: 1 })
    ).toMatchObject({ ok: false });
  });
});

describe("retirer un accès", () => {
  it("permis sur une autre personne", () => {
    expect(decideClientAccessRevocation({ actorId: "d1", target: RQ, activeDirectionCount: 1 })).toEqual({ ok: true });
  });
  it("jamais son propre accès, ni la dernière direction, ni deux fois", () => {
    expect(decideClientAccessRevocation({ actorId: "d1", target: DIRECTION, activeDirectionCount: 2 })).toMatchObject({ ok: false });
    expect(decideClientAccessRevocation({ actorId: "x", target: DIRECTION, activeDirectionCount: 1 })).toMatchObject({ ok: false });
    expect(
      decideClientAccessRevocation({ actorId: "d1", target: { ...RQ, revokedAt: new Date() }, activeDirectionCount: 1 })
    ).toMatchObject({ ok: false });
  });
});

describe("état et lecture", () => {
  it("dérive l'état affiché", () => {
    expect(deriveAccessStatus({ revokedAt: new Date(), mustChangePassword: false, isActive: true })).toBe("REVOKED");
    expect(deriveAccessStatus({ revokedAt: null, mustChangePassword: false, isActive: false })).toBe("REVOKED");
    expect(deriveAccessStatus({ revokedAt: null, mustChangePassword: true, isActive: true })).toBe("PENDING");
    expect(deriveAccessStatus({ revokedAt: null, mustChangePassword: false, isActive: true })).toBe("ACTIVE");
  });

  it("refuse un rôle inconnu — EODA n'est jamais un rôle client", () => {
    expect(parseClientAccessRole("INTERVENANT")).toBe("INTERVENANT");
    expect(parseClientAccessRole("EODA")).toBeNull();
    expect(parseClientAccessRole(undefined)).toBeNull();
  });

  it("la matrice affichée a 4 rôles × 7 modules", () => {
    const matrix = clientPermissionMatrix();
    expect(matrix.map((m) => m.role)).toEqual(["DIRECTION", "RESPONSABLE_QUALITE", "ADMINISTRATIF", "INTERVENANT"]);
    expect(matrix.every((m) => m.rows.length === 7)).toBe(true);
  });
});
