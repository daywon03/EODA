import { beforeEach, describe, expect, it, vi } from "vitest";

// Structure inscrite SEULE (PROSPECT_USER, libre-service D5) : elle n'entre que dans
// SON espace (lien ProspectAccount), jamais dans un portail client ou cabinet ; un
// client ou un cabinet n'entre jamais dans l'espace comme prospect.

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
  prospectAccount: { findUnique: vi.fn() },
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

const PROSPECT = {
  id: "prospect-1",
  tenantId: "tenant-1",
  structureName: "SAD Les Coquelicots (fictif)",
  establishmentType: "SAD_AIDE",
  envisagedFormule: "ESSENTIEL",
  establishmentId: null,
};

function signedInAs(role: string, overrides: Record<string, unknown> = {}) {
  authMock.mockResolvedValue({ user: { id: "user-1", role, mustChangePassword: false, authAt: null } });
  prismaMock.user.findUnique.mockResolvedValue({
    role,
    tenantId: role.startsWith("CABINET") ? "tenant-1" : null,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
    ...overrides,
  });
}

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

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.mission.findUnique.mockResolvedValue(null);
  prismaMock.establishmentAssignment.findMany.mockResolvedValue([]);
  prismaMock.prospectAccount.findUnique.mockResolvedValue({ prospect: PROSPECT });
});

describe("requireProspectSession", () => {
  it("rend le prospect DU LIEN de l'appelant — jamais un identifiant reçu", async () => {
    signedInAs("PROSPECT_USER");
    const context = await guards.requireProspectSession();
    expect(context.prospect).toEqual(PROSPECT);
    expect(prismaMock.prospectAccount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("non authentifié : vers la connexion", async () => {
    authMock.mockResolvedValue(null);
    await expect(outcome(() => guards.requireProspectSession())).resolves.toBe("REDIRECT:/login");
  });

  it("compte sans lien (prospect supprimé) : déconnecté, rien n'est servi", async () => {
    signedInAs("PROSPECT_USER");
    prismaMock.prospectAccount.findUnique.mockResolvedValue(null);
    await expect(outcome(() => guards.requireProspectSession())).resolves.toBe("REDIRECT:/deconnexion");
  });

  it("compte désactivé : déconnecté", async () => {
    signedInAs("PROSPECT_USER", { isActive: false });
    await expect(outcome(() => guards.requireProspectSession())).resolves.toBe("REDIRECT:/deconnexion");
  });

  it.each([
    ["CLIENT_USER", "REDIRECT:/dashboard/client"],
    ["CABINET_ADMIN", "REDIRECT:/dashboard/cabinet"],
    ["CABINET_COMMERCIAL", "REDIRECT:/dashboard/cabinet/commercial"],
  ])("%s n'entre pas dans l'espace comme prospect → %s", async (role, expected) => {
    signedInAs(role);
    await expect(outcome(() => guards.requireProspectSession())).resolves.toBe(expected);
    expect(prismaMock.prospectAccount.findUnique).not.toHaveBeenCalled();
  });
});

describe("une structure inscrite seule n'entre dans aucun autre portail", () => {
  beforeEach(() => signedInAs("PROSPECT_USER"));

  it("cabinet : renvoyée à son espace, même pour le commercial", async () => {
    await expect(outcome(() => guards.requireCommercialSession())).resolves.toBe("REDIRECT:/espace");
    await expect(guards.tryCabinetSession("COMMERCIAL")).resolves.toBeNull();
  });

  it("portail client : renvoyée à son espace", async () => {
    await expect(outcome(() => guards.requireClientEstablishment("HOME"))).resolves.toBe("REDIRECT:/espace");
  });

  it("un établissement, quel qu'il soit, est introuvable", async () => {
    await expect(outcome(() => guards.requireEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ))).resolves.toBe(
      "NOT_FOUND"
    );
    await expect(guards.tryEstablishmentAccess("etab-1", NEED.DOCUMENTS_READ)).resolves.toBeNull();
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });
});
