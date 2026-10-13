import { beforeEach, describe, expect, it, vi } from "vitest";

// authorize() — le SEUL point par lequel passe toute connexion. Tranche 11 : un compte
// créé en libre-service dont l'adresse n'est pas confirmée est refusé, APRÈS la
// vérification du mot de passe (aucun oracle), avec un code lisible par l'écran ;
// un compte créé par le cabinet n'a rien à confirmer.

class CredentialsSignin extends Error {
  code = "credentials";
}

type Authorize = (credentials: Record<string, string>, request: Request) => Promise<unknown>;
const captured: { authorize: Authorize | null } = { authorize: null };

const prismaMock = { user: { findUnique: vi.fn(), update: vi.fn() } };
const compare = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("next-auth", () => ({
  CredentialsSignin,
  default: (config: { providers: { authorize: Authorize }[] }) => {
    captured.authorize = config.providers[0]!.authorize;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("next-auth/providers/credentials", () => ({ default: (options: unknown) => options }));
vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("bcryptjs", () => ({ default: { compare: (...a: unknown[]) => compare(...a) } }));
vi.mock("@/lib/security/login-throttle", () => ({
  clientIpFromHeaders: () => "203.0.113.9",
  consumeLoginAttempt: () => Promise.resolve(true),
  resetLoginThrottle: () => Promise.resolve(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));

await import("./auth");
const { isEmailNotVerifiedError } = await import("@/lib/auth/email-not-verified");

function login(): Promise<unknown> {
  if (!captured.authorize) throw new Error("authorize non capturé");
  return captured.authorize({ email: "Direction@Glycines.example.org", password: "une phrase de passe longue" }, new Request("https://app.example.org"));
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "direction@glycines.example.org",
    name: "Nadia (fictif)",
    role: "PROSPECT_USER",
    passwordHash: "hash",
    isActive: true,
    mustChangePassword: false,
    emailVerifiedAt: null,
    prospectAccount: { id: "pa-1" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  compare.mockResolvedValue(true);
});

describe("authorize — adresse non confirmée (tranche 11)", () => {
  it("compte libre-service non confirmé : refusé avec le code, journalisé sans l'adresse, aucune connexion posée", async () => {
    prismaMock.user.findUnique.mockResolvedValue(account());
    const error = await login().then(
      () => null,
      (e: unknown) => e
    );
    expect(isEmailNotVerifiedError(error)).toBe(true);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "LOGIN_REFUSED_UNVERIFIED", actorUserId: "user-1" }));
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("glycines.example.org");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("mot de passe faux sur un compte non confirmé : refus GÉNÉRIQUE (rien n'est révélé)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(account());
    compare.mockResolvedValue(false);
    await expect(login()).resolves.toBeNull();
  });

  it("compte libre-service confirmé : connecté", async () => {
    prismaMock.user.findUnique.mockResolvedValue(account({ emailVerifiedAt: new Date() }));
    await expect(login()).resolves.toMatchObject({ id: "user-1", role: "PROSPECT_USER" });
  });

  it("compte créé par le cabinet, sans date de confirmation : connecté (rien à confirmer)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(account({ role: "CLIENT_USER", prospectAccount: null }));
    await expect(login()).resolves.toMatchObject({ id: "user-1", role: "CLIENT_USER" });
  });

  it("compte devenu client à la signature mais jamais confirmé : toujours refusé", async () => {
    prismaMock.user.findUnique.mockResolvedValue(account({ role: "CLIENT_USER" }));
    await expect(login()).rejects.toSatisfy(isEmailNotVerifiedError);
  });

  it("adresse inconnue : null, l'adresse normalisée est cherchée", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(login()).resolves.toBeNull();
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "direction@glycines.example.org" } })
    );
  });
});
