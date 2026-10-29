import { describe, expect, it } from "vitest";
import {
  assignmentScopeNotice,
  countActiveAdmins,
  countByRole,
  decideAccessRemoval,
  decideRoleChange,
  describeFollowedStructures,
  normalizeAssignments,
  parseCabinetRole,
} from "./cabinet-team-service";

const ADMIN = { id: "a1", role: "CABINET_ADMIN" as const, isActive: true };
const ADMIN_2 = { id: "a2", role: "CABINET_ADMIN" as const, isActive: true };
const CONSULTANTE = { id: "c1", role: "CABINET_EVALUATOR" as const, isActive: true };

describe("décompte des administrateurs", () => {
  it("ne compte que les administrateurs actifs", () => {
    expect(countActiveAdmins([ADMIN, { ...ADMIN_2, isActive: false }, CONSULTANTE])).toBe(1);
  });

  it("compte les personnes actives par rôle (cartes de rôles)", () => {
    expect(countByRole([ADMIN, CONSULTANTE, { ...CONSULTANTE, id: "c2", isActive: false }])).toEqual({
      CABINET_ADMIN: 1,
      CABINET_EVALUATOR: 1,
      CABINET_COMMERCIAL: 0,
      CABINET_READONLY: 0,
    });
  });
});

describe("retirer l'accès", () => {
  it("jamais son propre compte", () => {
    expect(decideAccessRemoval({ actorId: "a1", target: ADMIN, activeAdminCount: 2 })).toMatchObject({ ok: false });
  });

  it("jamais le dernier administrateur actif", () => {
    const decision = decideAccessRemoval({ actorId: "a2", target: ADMIN, activeAdminCount: 1 });
    expect(decision).toEqual({ ok: false, error: expect.stringContaining("dernier administrateur") });
  });

  it("un administrateur parmi deux peut perdre son accès", () => {
    expect(decideAccessRemoval({ actorId: "a2", target: ADMIN, activeAdminCount: 2 })).toEqual({ ok: true });
  });

  it("une consultante peut perdre son accès", () => {
    expect(decideAccessRemoval({ actorId: "a1", target: CONSULTANTE, activeAdminCount: 1 })).toEqual({ ok: true });
  });

  it("un accès déjà retiré ne se retire pas deux fois", () => {
    expect(
      decideAccessRemoval({ actorId: "a1", target: { ...CONSULTANTE, isActive: false }, activeAdminCount: 1 })
    ).toMatchObject({ ok: false });
  });
});

describe("changer un rôle", () => {
  it("garder le même rôle est toujours permis (seules les structures changent)", () => {
    expect(decideRoleChange({ actorId: "a1", target: ADMIN, newRole: "CABINET_ADMIN", activeAdminCount: 1 })).toEqual({
      ok: true,
    });
  });

  it("jamais son propre rôle", () => {
    expect(
      decideRoleChange({ actorId: "a1", target: ADMIN, newRole: "CABINET_READONLY", activeAdminCount: 2 })
    ).toMatchObject({ ok: false });
  });

  it("le dernier administrateur ne devient pas autre chose", () => {
    expect(
      decideRoleChange({ actorId: "a2", target: ADMIN, newRole: "CABINET_EVALUATOR", activeAdminCount: 1 })
    ).toMatchObject({ ok: false });
  });

  it("une consultante peut devenir commerciale", () => {
    expect(
      decideRoleChange({ actorId: "a1", target: CONSULTANTE, newRole: "CABINET_COMMERCIAL", activeAdminCount: 1 })
    ).toEqual({ ok: true });
  });
});

describe("structures suivies", () => {
  it("seule une consultante est affectée ; les identifiants étrangers sont ignorés", () => {
    expect(normalizeAssignments("CABINET_EVALUATOR", ["e1", "e-autre", "e1"], ["e1", "e2"])).toEqual(["e1"]);
    expect(normalizeAssignments("CABINET_ADMIN", ["e1"], ["e1"])).toEqual([]);
    expect(normalizeAssignments("CABINET_COMMERCIAL", ["e1"], ["e1"])).toEqual([]);
    expect(normalizeAssignments("CABINET_READONLY", ["e1"], ["e1"])).toEqual([]);
  });

  it("décrit ce que la personne suit", () => {
    expect(describeFollowedStructures("CABINET_EVALUATOR", [])).toBe("Aucune pour l'instant (à affecter)");
    expect(describeFollowedStructures("CABINET_EVALUATOR", ["SAD A (fictif)", "SAD B (fictif)"])).toBe(
      "SAD A (fictif), SAD B (fictif)"
    );
    expect(describeFollowedStructures("CABINET_ADMIN", [])).toBe("Toutes");
    expect(describeFollowedStructures("CABINET_COMMERCIAL", [])).toBe("Aucune (commercial)");
  });
});

describe("parseCabinetRole — pas de cast d'enum sur une entrée", () => {
  it("accepte les quatre rôles cabinet et rien d'autre", () => {
    expect(parseCabinetRole("CABINET_READONLY")).toBe("CABINET_READONLY");
    expect(parseCabinetRole("CLIENT_USER")).toBeNull();
    expect(parseCabinetRole("SUPERADMIN")).toBeNull();
    expect(parseCabinetRole(null)).toBeNull();
  });
});

describe("assignmentScopeNotice — consultante sans structure cochée", () => {
  it("avertit explicitement qu'elle ne verra aucune structure (29/10/2026)", () => {
    const notice = assignmentScopeNotice("CABINET_EVALUATOR", 0);
    expect(notice?.tone).toBe("warning");
    expect(notice?.text).toContain("ne verra aucune structure");
  });

  it("dit la portée quand des structures sont cochées", () => {
    expect(assignmentScopeNotice("CABINET_EVALUATOR", 1)?.text).toBe("Elle ne verra que la structure cochée.");
    expect(assignmentScopeNotice("CABINET_EVALUATOR", 3)).toEqual({ tone: "info", text: "Elle ne verra que les 3 structures cochées." });
  });

  it("ne dit rien pour les autres rôles", () => {
    expect(assignmentScopeNotice("CABINET_ADMIN", 0)).toBeNull();
    expect(assignmentScopeNotice("CABINET_READONLY", 0)).toBeNull();
  });
});
