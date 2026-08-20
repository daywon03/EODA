import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS de la couche d'autorisation face à la rotation de mot de passe (D7).
// Deux invariants vérifiés ici, et nulle part ailleurs :
//   - un compte porteur du drapeau `mustChangePassword` n'atteint AUCUNE route
//     authentifiée en dehors de la page de rotation ;
//   - une session ouverte AVANT le dernier changement de mot de passe est refusée,
//     y compris sur un autre appareil (invalidation des sessions concurrentes).
//
// `redirect()` et `notFound()` sont doublés par des exceptions typées : c'est ce que
// fait Next.js, et ça permet d'affirmer la DESTINATION du refus, pas seulement qu'il
// a eu lieu.

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

const {
  requireCabinetSession,
  requireEstablishmentAccess,
  requirePasswordRotationSession,
  tryEstablishmentAccess,
  isSessionStale,
} = await import("./guards");

const LOGIN_AT = Date.parse("2026-08-20T09:00:00Z");
const BEFORE_LOGIN = new Date("2026-08-20T08:00:00Z");
const AFTER_LOGIN = new Date("2026-08-20T10:00:00Z");

function session(authAt: number | null = LOGIN_AT) {
  return {
    user: { id: "user-1", role: "CABINET_ADMIN", mustChangePassword: false, authAt },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(session());
  prismaMock.establishment.findFirst.mockResolvedValue({ id: "etab-1" });
  prismaMock.establishmentUser.findUnique.mockResolvedValue({ establishmentId: "etab-1" });
});

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    role: "CABINET_ADMIN",
    tenantId: "tenant-1",
    mustChangePassword: false,
    passwordChangedAt: BEFORE_LOGIN,
    ...overrides,
  };
}

describe("rotation due", () => {
  it("renvoie un compte Cabinet vers la page de rotation au lieu du tableau de bord", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));

    await expect(requireCabinetSession()).rejects.toThrow("REDIRECT:/changer-mot-de-passe");
  });

  it("renvoie aussi sur une action portant un identifiant d'établissement", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));

    await expect(requireEstablishmentAccess("etab-1")).rejects.toThrow(
      "REDIRECT:/changer-mot-de-passe"
    );
    // Le refus intervient AVANT toute lecture métier.
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });

  it("refuse sèchement (null) sur la variante non redirigeante", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));

    await expect(tryEstablishmentAccess("etab-1")).resolves.toBeNull();
  });

  it("laisse passer la page de rotation elle-même", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ mustChangePassword: true }));

    await expect(requirePasswordRotationSession()).resolves.toMatchObject({
      userId: "user-1",
      mustChangePassword: true,
    });
  });

  it("laisse passer un compte à jour", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser());

    await expect(requireCabinetSession()).resolves.toMatchObject({ tenantId: "tenant-1" });
  });
});

describe("session périmée par un changement de mot de passe", () => {
  it("déconnecte une session ouverte avant le dernier changement", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ passwordChangedAt: AFTER_LOGIN }));

    await expect(requireCabinetSession()).rejects.toThrow("REDIRECT:/deconnexion");
  });

  it("déconnecte même la page de rotation — on ne change pas un mot de passe depuis une session périmée", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ passwordChangedAt: AFTER_LOGIN, mustChangePassword: true })
    );

    await expect(requirePasswordRotationSession()).rejects.toThrow("REDIRECT:/deconnexion");
  });

  it("ne périme pas un jeton émis avant l'introduction de la revendication authAt", async () => {
    authMock.mockResolvedValue(session(null));
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ passwordChangedAt: AFTER_LOGIN }));

    await expect(requireCabinetSession()).resolves.toMatchObject({ tenantId: "tenant-1" });
  });

  it("ne périme pas un compte sans horodatage de changement", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ passwordChangedAt: null }));

    await expect(requireCabinetSession()).resolves.toMatchObject({ tenantId: "tenant-1" });
  });
});

describe("isSessionStale", () => {
  it("compare l'heure de connexion à la date de changement du mot de passe", () => {
    const user = {
      role: "CABINET_ADMIN" as const,
      tenantId: "tenant-1",
      mustChangePassword: false,
      passwordChangedAt: AFTER_LOGIN,
    };
    expect(isSessionStale(session() as never, user)).toBe(true);
    expect(isSessionStale(session(AFTER_LOGIN.getTime() + 1) as never, user)).toBe(false);
  });
});
