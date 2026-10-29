import { beforeEach, describe, expect, it, vi } from "vitest";

// Lien de création du mot de passe (audit du 28/10/2026) : le jeton est l'autorisation,
// il ne sert qu'une fois, sous concurrence aussi, et ne pose que le mot de passe de SON
// compte.

const tx = {
  passwordSetupToken: { updateMany: vi.fn() },
  user: { update: vi.fn() },
};
const prismaMock = {
  passwordSetupToken: { findUnique: vi.fn() },
  $transaction: vi.fn(async (run: (t: typeof tx) => Promise<unknown>) => run(tx)),
};
const consumeThrottledAttempt = vi.fn(async (_o: unknown) => true);
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
vi.mock("@/lib/security/attempt-throttle", () => ({ consumeThrottledAttempt: (o: unknown) => consumeThrottledAttempt(o) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));
vi.mock("@/lib/security/password-hashing", () => ({ hashPassword: async () => "empreinte-du-nouveau" }));

const { openPasswordSetupLink, setPasswordFromLink } = await import("./password-setup");
const { generateOneTimeToken, hashOneTimeToken } = await import("@/lib/security/one-time-token");

const TOKEN = generateOneTimeToken();
const FUTURE = new Date(Date.now() + 3600_000);
const row = (overrides: Record<string, unknown> = {}) => ({
  id: "t1",
  tokenHash: hashOneTimeToken(TOKEN),
  userId: "u1",
  expiresAt: FUTURE,
  usedAt: null,
  user: { email: "camille@example.org", isActive: true },
  ...overrides,
});
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};
const GOOD = { token: TOKEN, newPassword: "une phrase de passe solide", confirmation: "une phrase de passe solide" };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.passwordSetupToken.findUnique.mockResolvedValue(row());
  tx.passwordSetupToken.updateMany.mockResolvedValue({ count: 1 });
  consumeThrottledAttempt.mockResolvedValue(true);
});

describe("openPasswordSetupLink — n'écrit rien", () => {
  it("lien valide : l'adresse du compte, rien n'est consommé", async () => {
    expect(await openPasswordSetupLink(TOKEN)).toEqual({ state: "VALID", email: "camille@example.org" });
    expect(tx.passwordSetupToken.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.passwordSetupToken.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: hashOneTimeToken(TOKEN) } }));
  });

  it("mal formé, inconnu, compte désactivé : INVALID ; expiré, déjà servi : dit tel quel, sans l'adresse", async () => {
    expect(await openPasswordSetupLink("court")).toEqual({ state: "INVALID", email: null });
    prismaMock.passwordSetupToken.findUnique.mockResolvedValueOnce(null);
    expect(await openPasswordSetupLink(TOKEN)).toEqual({ state: "INVALID", email: null });
    prismaMock.passwordSetupToken.findUnique.mockResolvedValueOnce(row({ user: { email: "x", isActive: false } }));
    expect(await openPasswordSetupLink(TOKEN)).toEqual({ state: "INVALID", email: null });
    prismaMock.passwordSetupToken.findUnique.mockResolvedValueOnce(row({ expiresAt: new Date(Date.now() - 1000) }));
    expect(await openPasswordSetupLink(TOKEN)).toEqual({ state: "EXPIRED", email: null });
    prismaMock.passwordSetupToken.findUnique.mockResolvedValueOnce(row({ usedAt: new Date() }));
    expect(await openPasswordSetupLink(TOKEN)).toEqual({ state: "USED", email: null });
  });
});

describe("setPasswordFromLink", () => {
  it("pose le mot de passe de SON compte, lève l'obligation de changement, consomme le lien dans la même transaction", async () => {
    expect(await setPasswordFromLink({ status: "IDLE" }, form(GOOD))).toEqual({ status: "DONE" });
    expect(tx.passwordSetupToken.updateMany).toHaveBeenCalledWith({ where: { id: "t1", usedAt: null, expiresAt: { gt: expect.any(Date) } }, data: { usedAt: expect.any(Date) } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { passwordHash: "empreinte-du-nouveau", mustChangePassword: false, passwordChangedAt: expect.any(Date) } });
    expect(recordAuditEvent).toHaveBeenCalledWith({ action: "PASSWORD_SET_FROM_LINK", actorUserId: "u1", targetId: "u1" });
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain(TOKEN);
  });

  it("deux envois simultanés : le second ne pose RIEN (usage unique atomique)", async () => {
    tx.passwordSetupToken.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await setPasswordFromLink({ status: "IDLE" }, form(GOOD))).toEqual({ status: "ERROR", error: expect.stringContaining("déjà servi") });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("mot de passe trop court ou confirmation différente : refusé AVANT de lire le lien", async () => {
    expect(await setPasswordFromLink({ status: "IDLE" }, form({ ...GOOD, newPassword: "court", confirmation: "court" }))).toMatchObject({ status: "ERROR" });
    expect(await setPasswordFromLink({ status: "IDLE" }, form({ ...GOOD, confirmation: "autre chose de long" }))).toMatchObject({ status: "ERROR" });
    expect(prismaMock.passwordSetupToken.findUnique).not.toHaveBeenCalled();
  });

  it("débit dépassé : rien n'est lu ni écrit ; lien expiré : refusé", async () => {
    consumeThrottledAttempt.mockResolvedValueOnce(false);
    expect(await setPasswordFromLink({ status: "IDLE" }, form(GOOD))).toEqual({ status: "ERROR", error: expect.stringContaining("Trop de tentatives") });
    expect(prismaMock.passwordSetupToken.findUnique).not.toHaveBeenCalled();
    prismaMock.passwordSetupToken.findUnique.mockResolvedValueOnce(row({ expiresAt: new Date(Date.now() - 1000) }));
    expect(await setPasswordFromLink({ status: "IDLE" }, form(GOOD))).toEqual({ status: "ERROR", error: expect.stringContaining("expiré") });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
