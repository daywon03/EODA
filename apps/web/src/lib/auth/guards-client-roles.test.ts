import { beforeEach, describe, expect, it, vi } from "vitest";

// Gardes côté CLIENT × rôle d'accès (N9) : le module demandé suit la matrice, un
// lien retiré n'ouvre plus rien, une autre structure reste introuvable, la portée
// « ses tâches » est rendue à l'action.

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

const { requireClientEstablishment, requireEstablishmentAccess, tryEstablishmentAccess } = await import("./guards");
const { NEED } = await import("./capabilities");

function link(accessRole: string, revokedAt: Date | null = null) {
  prismaMock.establishmentUser.findUnique.mockResolvedValue({ establishmentId: "etab-1", accessRole, revokedAt });
  prismaMock.establishmentUser.findFirst.mockResolvedValue({
    accessRole,
    establishment: { id: "etab-1", name: "SAD Les Glycines (fictif)", type: "SAD_AIDE", logoDataUri: null },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "client-1", role: "CLIENT_USER", mustChangePassword: false, authAt: null } });
  prismaMock.user.findUnique.mockResolvedValue({
    role: "CLIENT_USER",
    tenantId: null,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
  });
  prismaMock.mission.findUnique.mockResolvedValue(null);
});

async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "PASS";
  } catch (error) {
    if (error instanceof RedirectError) return error.message;
    if (error instanceof NotFoundError) return "NOT_FOUND";
    throw error;
  }
}

describe("requireEstablishmentAccess côté client × rôle d'accès", () => {
  it.each([
    ["DIRECTION", NEED.DOCUMENTS_WRITE, "PASS"],
    ["RESPONSABLE_QUALITE", NEED.DIAGNOSTIC_WRITE, "PASS"],
    ["RESPONSABLE_QUALITE", NEED.ACCESS_WRITE, "NOT_FOUND"],
    ["ADMINISTRATIF", NEED.DOCUMENTS_WRITE, "PASS"],
    ["ADMINISTRATIF", NEED.DIAGNOSTIC_READ, "NOT_FOUND"],
    ["INTERVENANT", NEED.DOCUMENTS_READ, "NOT_FOUND"],
    ["INTERVENANT", NEED.TASKS_WRITE, "PASS"],
  ] as const)("%s / %o → %s", async (role, need, expected) => {
    link(role);
    await expect(outcome(() => requireEstablishmentAccess("etab-1", need))).resolves.toBe(expected);
  });

  it("rend « ses tâches seulement » à l'intervenant", async () => {
    link("INTERVENANT");
    await expect(requireEstablishmentAccess("etab-1", NEED.TASKS_READ)).resolves.toMatchObject({
      isClient: true,
      ownOnly: true,
      clientAccessRole: "INTERVENANT",
    });
    link("DIRECTION");
    await expect(requireEstablishmentAccess("etab-1", NEED.TASKS_READ)).resolves.toMatchObject({ ownOnly: false });
  });

  it("un lien retiré par la direction n'ouvre plus rien", async () => {
    link("DIRECTION", new Date("2026-10-01"));
    await expect(outcome(() => requireEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ))).resolves.toBe("NOT_FOUND");
    await expect(tryEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ)).resolves.toBeNull();
  });

  it("une autre structure : introuvable", async () => {
    prismaMock.establishmentUser.findUnique.mockResolvedValue(null);
    await expect(outcome(() => requireEstablishmentAccess("etab-autre", NEED.DOCUMENTS_READ))).resolves.toBe("NOT_FOUND");
  });

  it("accès de fin de mission révoqué : introuvable, quel que soit le rôle", async () => {
    link("DIRECTION");
    prismaMock.mission.findUnique.mockResolvedValue({ closedAt: new Date(), clientAccessRevokedAt: new Date() });
    await expect(outcome(() => requireEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ))).resolves.toBe("NOT_FOUND");
  });
});

describe("requireClientEstablishment — module de la page", () => {
  it("l'accueil s'ouvre à tout rôle, et rend le rôle d'accès", async () => {
    link("INTERVENANT");
    await expect(requireClientEstablishment("HOME")).resolves.toMatchObject({ accessRole: "INTERVENANT" });
  });

  it("un module hors du rôle renvoie à l'accueil du portail", async () => {
    link("INTERVENANT");
    await expect(outcome(() => requireClientEstablishment(NEED.DOCUMENTS_READ))).resolves.toBe(
      "REDIRECT:/dashboard/client"
    );
    link("RESPONSABLE_QUALITE");
    await expect(outcome(() => requireClientEstablishment(NEED.ACCESS_READ))).resolves.toBe("REDIRECT:/dashboard/client");
  });

  it("ne lit que les liens ACTIFS", async () => {
    link("DIRECTION");
    await requireClientEstablishment("HOME");
    expect(prismaMock.establishmentUser.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "client-1", revokedAt: null } })
    );
  });

  it("un compte cabinet est renvoyé au cabinet", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      role: "CABINET_READONLY",
      tenantId: "t-1",
      isActive: true,
      mustChangePassword: false,
      passwordChangedAt: null,
    });
    await expect(outcome(() => requireClientEstablishment("HOME"))).resolves.toBe("REDIRECT:/dashboard/cabinet");
  });
});
