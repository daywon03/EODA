import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Gardes cabinet × rôles N9 (13/10/2026). La matrice PURE est testée case par case
// dans capabilities.test.ts ; ici, on prouve que les GARDES l'appliquent : chaque
// rôle passe ou est refusé, avec la bonne destination, sur chaque garde cabinet ;
// l'affectation consultante ferme les structures non affectées ; un autre tenant
// reste introuvable.
// ─────────────────────────────────────────────────────────────────────────────

class RedirectError extends Error {
  constructor(readonly to: string) {
    super(`REDIRECT:${to}`);
  }
}
class NotFoundError extends Error {}

const prismaMock = {
  user: { findUnique: vi.fn() },
  establishment: { findFirst: vi.fn() },
  establishmentUser: { findUnique: vi.fn(), findFirst: vi.fn() },
  mission: { findUnique: vi.fn() },
  establishmentAssignment: { findMany: vi.fn() },
};
const authMock = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
  notFound: () => {
    throw new NotFoundError();
  },
}));

const guards = await import("./guards");
const { NEED } = await import("./capabilities");

function asRole(role: string, overrides: Record<string, unknown> = {}) {
  prismaMock.user.findUnique.mockResolvedValue({
    role,
    tenantId: role === "CLIENT_USER" ? null : "tenant-1",
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "user-1", role: "CABINET_ADMIN", mustChangePassword: false, authAt: null } });
  prismaMock.establishment.findFirst.mockResolvedValue({ id: "etab-1", type: "SAD_AIDE" });
  prismaMock.establishmentUser.findUnique.mockResolvedValue({ establishmentId: "etab-1" });
  prismaMock.mission.findUnique.mockResolvedValue(null);
  prismaMock.establishmentAssignment.findMany.mockResolvedValue([]);
});

const PASS = "PASS";
async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return PASS;
  } catch (error) {
    if (error instanceof RedirectError) return error.message;
    if (error instanceof NotFoundError) return "NOT_FOUND";
    throw error;
  }
}

describe("chaque garde cabinet × chaque rôle", () => {
  const LANDING = "REDIRECT:/dashboard/cabinet";
  const COMMERCIAL_LANDING = "REDIRECT:/dashboard/cabinet/commercial";
  const CLIENT = "REDIRECT:/dashboard/client";

  const table: [string, () => Promise<unknown>, Record<string, string>][] = [
    [
      "lecture d'une structure",
      () => guards.requireEstablishmentInTenant("etab-1", "READ"),
      { CABINET_ADMIN: PASS, CABINET_EVALUATOR: PASS, CABINET_READONLY: PASS, CABINET_COMMERCIAL: COMMERCIAL_LANDING, CLIENT_USER: CLIENT },
    ],
    [
      "écriture sur une structure",
      () => guards.requireEstablishmentInTenant("etab-1", "WRITE"),
      { CABINET_ADMIN: PASS, CABINET_EVALUATOR: PASS, CABINET_READONLY: LANDING, CABINET_COMMERCIAL: COMMERCIAL_LANDING, CLIENT_USER: CLIENT },
    ],
    [
      "montants d'une structure (contrat, avenant, périmètre)",
      () => guards.requireEstablishmentInTenant("etab-1", "CONTRACT"),
      { CABINET_ADMIN: PASS, CABINET_EVALUATOR: LANDING, CABINET_READONLY: LANDING, CABINET_COMMERCIAL: COMMERCIAL_LANDING, CLIENT_USER: CLIENT },
    ],
    [
      "pipeline commercial",
      () => guards.requireCommercialSession(),
      { CABINET_ADMIN: PASS, CABINET_EVALUATOR: LANDING, CABINET_READONLY: LANDING, CABINET_COMMERCIAL: PASS, CLIENT_USER: CLIENT },
    ],
    [
      "équipe EODA",
      () => guards.requireTeamManagerSession(),
      { CABINET_ADMIN: PASS, CABINET_EVALUATOR: LANDING, CABINET_READONLY: LANDING, CABINET_COMMERCIAL: COMMERCIAL_LANDING, CLIENT_USER: CLIENT },
    ],
    [
      "réglages de cabinet",
      () => guards.requireCabinetAdminSession(),
      { CABINET_ADMIN: PASS, CABINET_EVALUATOR: LANDING, CABINET_READONLY: LANDING, CABINET_COMMERCIAL: COMMERCIAL_LANDING, CLIENT_USER: CLIENT },
    ],
    [
      "coquille cabinet",
      () => guards.requireCabinetSession("ANY_CABINET_ROLE"),
      { CABINET_ADMIN: PASS, CABINET_EVALUATOR: PASS, CABINET_READONLY: PASS, CABINET_COMMERCIAL: PASS, CLIENT_USER: CLIENT },
    ],
  ];

  const cases = table.flatMap(([label, run, expected]) =>
    Object.entries(expected).map(([role, result]) => [label, role, result, run] as const)
  );

  it.each(cases)("%s — %s → %s", async (_label, role, expected, run) => {
    asRole(role);
    await expect(outcome(run)).resolves.toBe(expected);
  });
});

describe("garde partagée (requireEstablishmentAccess) côté cabinet", () => {
  it("la lecture seule lit un document, n'en dépose pas", async () => {
    asRole("CABINET_READONLY");
    await expect(outcome(() => guards.requireEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ))).resolves.toBe(PASS);
    await expect(outcome(() => guards.requireEstablishmentAccess("etab-1", NEED.DOCUMENTS_WRITE))).resolves.toBe(
      "NOT_FOUND"
    );
  });

  it("le commercial n'atteint aucun document de structure", async () => {
    asRole("CABINET_COMMERCIAL");
    await expect(outcome(() => guards.requireEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ))).resolves.toBe(
      "NOT_FOUND"
    );
    await expect(guards.tryEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ)).resolves.toBeNull();
    // Refusé AVANT de lire la structure : aucun oracle d'existence.
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });

  it("la consultante écrit sur une structure de son périmètre", async () => {
    asRole("CABINET_EVALUATOR");
    await expect(outcome(() => guards.requireEstablishmentAccess("etab-1", NEED.TASKS_WRITE))).resolves.toBe(PASS);
  });
});

describe("affectation consultante ↔ structures", () => {
  it("une structure non affectée est introuvable, sans même être lue", async () => {
    asRole("CABINET_EVALUATOR");
    prismaMock.establishmentAssignment.findMany.mockResolvedValue([{ establishmentId: "etab-autre" }]);

    await expect(outcome(() => guards.requireEstablishmentInTenant("etab-1", "READ"))).resolves.toBe("NOT_FOUND");
    await expect(guards.tryEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ)).resolves.toBeNull();
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });

  it("une structure affectée s'ouvre", async () => {
    asRole("CABINET_EVALUATOR");
    prismaMock.establishmentAssignment.findMany.mockResolvedValue([{ establishmentId: "etab-1" }]);

    await expect(guards.requireEstablishmentInTenant("etab-1", "WRITE")).resolves.toMatchObject({
      establishmentId: "etab-1",
      structureScope: { kind: "ONLY", establishmentIds: ["etab-1"] },
    });
  });

  it("sans aucune affectation, la consultante garde tout le portefeuille (compatibilité)", async () => {
    asRole("CABINET_EVALUATOR");
    await expect(guards.requireCabinetSession("STRUCTURES_READ")).resolves.toMatchObject({
      structureScope: { kind: "ALL" },
    });
  });

  it("l'administration n'est jamais filtrée — les affectations ne sont même pas lues", async () => {
    asRole("CABINET_ADMIN");
    await guards.requireCabinetSession("STRUCTURES_READ");
    expect(prismaMock.establishmentAssignment.findMany).not.toHaveBeenCalled();
  });

  it("structureScopeWhere borne une liste au tenant ET aux structures affectées", async () => {
    asRole("CABINET_EVALUATOR");
    prismaMock.establishmentAssignment.findMany.mockResolvedValue([{ establishmentId: "etab-1" }]);
    const context = await guards.requireCabinetSession("STRUCTURES_READ");
    expect(guards.structureScopeWhere(context)).toEqual({ tenantId: "tenant-1", id: { in: ["etab-1"] } });
  });

  it("requireStructureInScope refuse un objet d'une structure hors périmètre", async () => {
    asRole("CABINET_EVALUATOR");
    prismaMock.establishmentAssignment.findMany.mockResolvedValue([{ establishmentId: "etab-1" }]);
    const context = await guards.requireCabinetSession("STRUCTURES_WRITE");
    expect(() => guards.requireStructureInScope(context, "etab-2")).toThrow(NotFoundError);
    expect(() => guards.requireStructureInScope(context, "etab-1")).not.toThrow();
  });
});

describe("autre tenant et compte révoqué, quel que soit le rôle", () => {
  it.each(["CABINET_ADMIN", "CABINET_EVALUATOR", "CABINET_READONLY"])(
    "%s : structure d'un autre tenant introuvable",
    async (role) => {
      asRole(role);
      prismaMock.establishment.findFirst.mockResolvedValue(null);
      await expect(outcome(() => guards.requireEstablishmentInTenant("etab-x", "READ"))).resolves.toBe("NOT_FOUND");
    }
  );

  it.each(["CABINET_COMMERCIAL", "CABINET_READONLY"])("%s désactivé : déconnecté", async (role) => {
    asRole(role, { isActive: false });
    await expect(outcome(() => guards.requireCabinetSession("ANY_CABINET_ROLE"))).resolves.toBe(
      "REDIRECT:/deconnexion"
    );
  });

  it("non authentifié : renvoyé à la connexion", async () => {
    authMock.mockResolvedValue(null);
    await expect(outcome(() => guards.requireTeamManagerSession())).resolves.toBe("REDIRECT:/login");
    await expect(guards.tryCabinetSession("STRUCTURES_READ")).resolves.toBeNull();
  });

  it("tryCabinetSession refuse sèchement un rôle sans la capacité", async () => {
    asRole("CABINET_COMMERCIAL");
    await expect(guards.tryCabinetSession("STRUCTURES_READ")).resolves.toBeNull();
    asRole("CABINET_READONLY");
    await expect(guards.tryCabinetSession("STRUCTURES_READ")).resolves.toMatchObject({ role: "CABINET_READONLY" });
  });
});
