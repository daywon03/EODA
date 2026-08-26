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
  // Fin de mission : les gardes lisent la clôture et la révocation à CHAQUE contrôle
  // (une révocation doit prendre effet tout de suite, pas à la prochaine session).
  mission: { findUnique: vi.fn() },
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
  requireCabinetAdminSession,
  requireClientEstablishment,
  requireEstablishmentAccess,
  requireEstablishmentInTenant,
  requireHelpAudience,
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
  // Par défaut : aucune mission (avant-vente) — rien n'est clos, rien n'est coupé.
  prismaMock.mission.findUnique.mockResolvedValue(null);
});

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    role: "CABINET_ADMIN",
    tenantId: "tenant-1",
    isActive: true,
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
      isActive: true,
      mustChangePassword: false,
      passwordChangedAt: AFTER_LOGIN,
    };
    expect(isSessionStale(session() as never, user)).toBe(true);
    expect(isSessionStale(session(AFTER_LOGIN.getTime() + 1) as never, user)).toBe(false);
  });
});

// Cas de REFUS de la révocation de compte (D7). Un compte désactivé doit être refusé
// PAR LA COUCHE D'AUTORISATION, pas seulement à la connexion : sinon une session
// ouverte au moment de la désactivation continue de servir jusqu'à son expiration
// (8 h), ce qui n'est pas une révocation.
describe("compte désactivé", () => {
  it("déconnecte un compte Cabinet désactivé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ isActive: false }));

    await expect(requireCabinetSession()).rejects.toThrow("REDIRECT:/deconnexion");
  });

  it("refuse une action portant un identifiant d'établissement, avant toute lecture métier", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ isActive: false }));

    await expect(requireEstablishmentAccess("etab-1")).rejects.toThrow("REDIRECT:/deconnexion");
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });

  it("refuse un compte client désactivé sur la variante non redirigeante", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", isActive: false }));

    await expect(tryEstablishmentAccess("etab-1")).resolves.toBeNull();
    expect(prismaMock.establishmentUser.findUnique).not.toHaveBeenCalled();
  });

  it("ne laisse même pas changer son mot de passe — la désactivation n'a aucune exemption", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ isActive: false, mustChangePassword: true })
    );

    await expect(requirePasswordRotationSession()).rejects.toThrow("REDIRECT:/deconnexion");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cas de REFUS des gardes qui n'en avaient aucun (D7). Ce fichier ne couvrait que
// trois des huit gardes exportées : la rotation, la révocation et l'accès à un
// établissement. Les cinq autres portent pourtant les invariants les plus coûteux à
// casser — cloisonnement par tenant, réserve du commercial au seul CABINET_ADMIN,
// fail-closed sur un compte sans tenant. Une régression IDOR sur ces chemins serait
// passée sans faire rougir la CI, ce qui revient à ne pas avoir la règle du tout.
// ─────────────────────────────────────────────────────────────────────────────

describe("requireCabinetAdminSession — réserve du pipeline commercial", () => {
  it("refuse un CABINET_EVALUATOR, même parfaitement légitime par ailleurs", async () => {
    // Le rôle est relu EN BASE : le jeton, lui, annonce CABINET_ADMIN (cf. session()).
    // C'est exactement le scénario d'un compte rétrogradé dont la session court encore.
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CABINET_EVALUATOR" }));

    await expect(requireCabinetAdminSession()).rejects.toThrow("REDIRECT:/dashboard/cabinet");
  });

  it("refuse un CLIENT_USER", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));

    await expect(requireCabinetAdminSession()).rejects.toThrow("REDIRECT:/dashboard/cabinet");
  });

  it("refuse un CABINET_ADMIN sans tenant plutôt que de lui ouvrir un accès non filtré", async () => {
    // Fail-closed (CLAUDE.md §5 bis) : pas de tenant ⇒ pas d'accès. Le laisser passer
    // rendrait chaque requête suivante globale, donc inter-clients.
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ tenantId: null }));

    await expect(requireCabinetAdminSession()).rejects.toThrow("REDIRECT:/dashboard/cabinet");
  });

  it("refuse un compte désactivé avant même de regarder son rôle", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ isActive: false }));

    await expect(requireCabinetAdminSession()).rejects.toThrow("REDIRECT:/deconnexion");
  });

  it("laisse passer un CABINET_ADMIN et résout son tenant", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser());

    await expect(requireCabinetAdminSession()).resolves.toMatchObject({
      userId: "user-1",
      tenantId: "tenant-1",
    });
  });
});

describe("requireEstablishmentInTenant — cloisonnement inter-tenants (IDOR)", () => {
  it("filtre la lecture sur le tenant de l'appelant, pas sur le seul identifiant reçu", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser());

    await requireEstablishmentInTenant("etab-1");

    // Le `where` doit porter les DEUX clauses. Un filtre `tenantId` omis rendrait la
    // requête globale : l'établissement d'un autre cabinet serait résolu normalement.
    expect(prismaMock.establishment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "etab-1", tenantId: "tenant-1" } })
    );
  });

  it("répond introuvable — et non « interdit » — sur un établissement d'un autre tenant", async () => {
    // notFound() et jamais redirect() : un 403 confirmerait que l'identifiant existe
    // ailleurs, ce qui suffit à énumérer le portefeuille clients d'un concurrent.
    prismaMock.user.findUnique.mockResolvedValue(dbUser());
    prismaMock.establishment.findFirst.mockResolvedValue(null);

    await expect(requireEstablishmentInTenant("etab-dun-autre")).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("refuse un CLIENT_USER, qui n'a rien à faire sur une garde Cabinet", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));

    await expect(requireEstablishmentInTenant("etab-1")).rejects.toThrow(
      "REDIRECT:/dashboard/client"
    );
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });
});

describe("requireEstablishmentAccess — cloisonnement côté client", () => {
  it("refuse un CLIENT_USER sans lien vers l'établissement demandé", async () => {
    // Le cloisonnement client ne vient pas du tenant mais du lien EstablishmentUser.
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.establishmentUser.findUnique.mockResolvedValue(null);

    await expect(requireEstablishmentAccess("etab-dun-autre")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("résout le lien sur le couple (utilisateur, établissement), jamais sur l'établissement seul", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));

    await requireEstablishmentAccess("etab-1");

    expect(prismaMock.establishmentUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_establishmentId: { userId: "user-1", establishmentId: "etab-1" } },
      })
    );
  });

  it("laisse passer un compte Cabinet sur un établissement de son tenant", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser());

    await expect(requireEstablishmentAccess("etab-1")).resolves.toMatchObject({
      establishmentId: "etab-1",
      isClient: false,
    });
  });

  it("refuse un compte Cabinet orphelin de tenant sans jamais interroger les établissements", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ tenantId: null }));

    await expect(requireEstablishmentAccess("etab-1")).rejects.toThrow("REDIRECT:/login");
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });
});

describe("fin de mission — accès client révoqué", () => {
  const REVOKED = { closedAt: new Date("2027-01-01"), clientAccessRevokedAt: new Date("2027-02-01") };
  const LIBRARY = { closedAt: new Date("2027-01-01"), clientAccessRevokedAt: null };

  it("refuse un CLIENT_USER dont l'accès a été révoqué", async () => {
    // Cas de refus le plus important du lot : les documents existent toujours, la
    // porte est fermée. notFound() et pas un message — on ne renseigne personne.
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.mission.findUnique.mockResolvedValue(REVOKED);

    await expect(requireEstablishmentAccess("etab-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("laisse passer le CLIENT_USER en bibliothèque — la clôture ne coupe pas la lecture", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.mission.findUnique.mockResolvedValue(LIBRARY);

    await expect(requireEstablishmentAccess("etab-1")).resolves.toMatchObject({
      isClient: true,
      missionAccess: "LIBRARY",
    });
  });

  it("laisse passer le cabinet même après révocation — la rétention est de son côté", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser());
    prismaMock.mission.findUnique.mockResolvedValue(REVOKED);

    await expect(requireEstablishmentAccess("etab-1")).resolves.toMatchObject({
      isClient: false,
      missionAccess: "REVOKED",
    });
  });

  it("refuse sèchement côté tryEstablishmentAccess, sans navigation", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.mission.findUnique.mockResolvedValue(REVOKED);

    await expect(tryEstablishmentAccess("etab-1")).resolves.toBeNull();
  });

  it("rend l'établissement introuvable au portail client révoqué", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.establishmentUser.findFirst.mockResolvedValue({
      establishment: { id: "etab-1", name: "SAD", type: "SAD_AIDE" },
    });
    prismaMock.mission.findUnique.mockResolvedValue(REVOKED);

    await expect(requireClientEstablishment()).resolves.toMatchObject({
      establishment: null,
      missionAccess: "REVOKED",
    });
  });

  it("relit la clôture à chaque contrôle — une révocation prend effet immédiatement", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.mission.findUnique.mockResolvedValue(LIBRARY);

    await requireEstablishmentAccess("etab-1");

    expect(prismaMock.mission.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { establishmentId: "etab-1" } })
    );
  });
});

describe("tryEstablishmentAccess — refus sec, sans navigation", () => {
  it("refuse en l'absence de session", async () => {
    authMock.mockResolvedValue(null);

    await expect(tryEstablishmentAccess("etab-1")).resolves.toBeNull();
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuse un établissement hors tenant", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser());
    prismaMock.establishment.findFirst.mockResolvedValue(null);

    await expect(tryEstablishmentAccess("etab-dun-autre")).resolves.toBeNull();
  });

  it("refuse un compte Cabinet sans tenant", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ tenantId: null }));

    await expect(tryEstablishmentAccess("etab-1")).resolves.toBeNull();
  });

  it("laisse passer un CLIENT_USER lié à l'établissement", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));

    await expect(tryEstablishmentAccess("etab-1")).resolves.toMatchObject({ isClient: true });
  });

  it("refuse un CLIENT_USER sans lien", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.establishmentUser.findUnique.mockResolvedValue(null);

    await expect(tryEstablishmentAccess("etab-dun-autre")).resolves.toBeNull();
  });
});

describe("requireClientEstablishment — l'établissement vient du lien, pas de la requête", () => {
  it("refuse un compte Cabinet", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser());

    await expect(requireClientEstablishment()).rejects.toThrow("REDIRECT:/dashboard/cabinet");
  });

  it("résout l'établissement à partir du seul identifiant de session", async () => {
    // Aucun identifiant d'établissement n'est accepté en entrée : il n'y a donc rien
    // à falsifier depuis le navigateur.
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.establishmentUser.findFirst.mockResolvedValue({
      establishment: { id: "etab-1", name: "SAD de démonstration", type: "SAD_MIXTE" },
    });

    await expect(requireClientEstablishment()).resolves.toMatchObject({
      establishment: { id: "etab-1" },
    });
    expect(prismaMock.establishmentUser.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } })
    );
  });

  it("renvoie un établissement nul — et non une erreur — pour un client pas encore rattaché", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));
    prismaMock.establishmentUser.findFirst.mockResolvedValue(null);

    await expect(requireClientEstablishment()).resolves.toMatchObject({ establishment: null });
  });

  it("refuse un compte client désactivé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      dbUser({ role: "CLIENT_USER", tenantId: null, isActive: false })
    );

    await expect(requireClientEstablishment()).rejects.toThrow("REDIRECT:/deconnexion");
  });
});

describe("requireHelpAudience — ouverte aux trois rôles, mais pas aux comptes révoqués", () => {
  it.each(["CABINET_ADMIN", "CABINET_EVALUATOR", "CLIENT_USER"] as const)(
    "laisse passer %s et renvoie le rôle relu en base",
    async (role) => {
      prismaMock.user.findUnique.mockResolvedValue(dbUser({ role }));

      await expect(requireHelpAudience()).resolves.toMatchObject({ role });
    }
  );

  it("renvoie le rôle de la BASE et non celui du jeton, pour un compte rétrogradé", async () => {
    // Le jeton annonce CABINET_ADMIN ; la base dit CLIENT_USER. Le filtrage du contenu
    // du centre d'aide doit suivre la base, sinon la rétrogradation ne prend effet
    // qu'à l'expiration de la session (8 h).
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ role: "CLIENT_USER", tenantId: null }));

    await expect(requireHelpAudience()).resolves.toMatchObject({ role: "CLIENT_USER" });
  });

  it("refuse un compte désactivé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(dbUser({ isActive: false }));

    await expect(requireHelpAudience()).rejects.toThrow("REDIRECT:/deconnexion");
  });
});

describe("absence de session et compte supprimé", () => {
  it("renvoie vers la connexion quand aucune session n'est ouverte", async () => {
    authMock.mockResolvedValue(null);

    await expect(requireCabinetSession()).rejects.toThrow("REDIRECT:/login");
  });

  it("renvoie vers la connexion quand la session désigne un compte supprimé en base", async () => {
    // Le jeton reste valide 8 h après la suppression du compte : sans cette relecture,
    // il continuerait à ouvrir des portes.
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(requireCabinetSession()).rejects.toThrow("REDIRECT:/login");
  });
});
