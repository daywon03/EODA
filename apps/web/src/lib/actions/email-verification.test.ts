import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateOneTimeToken, hashOneTimeToken } from "@/lib/security/one-time-token";

// Confirmation d'adresse (tranche 11) — deux actions PUBLIQUES. Ce qui est prouvé :
// jeton mal formé refusé sans lecture, débit, empreinte inconnue, expiré, réutilisé,
// usage unique atomique ; renvoi identique que l'adresse existe ou non, lien à
// l'écran en développement seulement.

const tx = {
  emailVerificationToken: { updateMany: vi.fn(), create: vi.fn() },
  user: { updateMany: vi.fn() },
};
const prismaMock = {
  emailVerificationToken: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn((run: (t: typeof tx) => unknown) => run(tx)),
};
const consumeThrottledAttempt = vi.fn();
const recordAuditEvent = vi.fn();
const sendEmailConfirmationEmail = vi.fn();
const after = vi.fn();
const env = { isDevelopment: false, resend: { apiKey: "k", from: "f" } as { apiKey: string; from: string } | null };

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.9" })) }));
vi.mock("next/server", () => ({ after: (task: unknown) => after(task) }));
vi.mock("@/lib/config/env", () => ({ getEnv: () => env }));
vi.mock("@/lib/security/attempt-throttle", () => ({
  consumeThrottledAttempt: (...args: unknown[]) => consumeThrottledAttempt(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock("@/lib/email/notifications", () => ({
  sendEmailConfirmationEmail: (...a: unknown[]) => sendEmailConfirmationEmail(...a),
}));

const { confirmEmailAddress, resendVerificationLink } = await import("./email-verification");
const { RESEND_NEUTRAL_MESSAGE } = await import("@/lib/services/email-verification-service");

const TOKEN = generateOneTimeToken();
const FUTURE = new Date(Date.now() + 3600_000);

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

function row(overrides: Record<string, unknown> = {}) {
  return { id: "tok-1", tokenHash: hashOneTimeToken(TOKEN), userId: "user-1", expiresAt: FUTURE, usedAt: null, ...overrides };
}

function pendingUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "direction@glycines.example.org",
    name: "Nadia (fictif)",
    isActive: true,
    emailVerifiedAt: null,
    prospectAccount: { prospect: { structureName: "SAD Les Glycines (fictif)" } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  consumeThrottledAttempt.mockResolvedValue(true);
  prismaMock.emailVerificationToken.findUnique.mockResolvedValue(row());
  tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.user.findUnique.mockResolvedValue(pendingUser());
  sendEmailConfirmationEmail.mockResolvedValue("SENT");
  env.isDevelopment = false;
  env.resend = { apiKey: "k", from: "f" };
});

describe("confirmEmailAddress", () => {
  it("cas nominal : clôt le jeton et confirme l'adresse, une seule fois, journalisé sans adresse", async () => {
    await expect(confirmEmailAddress({ outcome: null }, form({ token: TOKEN }))).resolves.toEqual({ outcome: "CONFIRMED" });
    expect(tx.emailVerificationToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "tok-1", usedAt: null }) })
    );
    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1", emailVerifiedAt: null } })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "EMAIL_VERIFIED", targetId: "user-1" }));
  });

  it("jeton mal formé : refus sans lecture ni débit consommé", async () => {
    await expect(confirmEmailAddress({ outcome: null }, form({ token: "pas-un-jeton" }))).resolves.toEqual({ outcome: "INVALID" });
    expect(consumeThrottledAttempt).not.toHaveBeenCalled();
    expect(prismaMock.emailVerificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("débit dépassé : refus avant la lecture", async () => {
    consumeThrottledAttempt.mockResolvedValueOnce(false);
    await expect(confirmEmailAddress({ outcome: null }, form({ token: TOKEN }))).resolves.toEqual({ outcome: "RATE_LIMITED" });
    expect(prismaMock.emailVerificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("jeton inconnu : INVALID, rien n'est écrit", async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue(null);
    await expect(confirmEmailAddress({ outcome: null }, form({ token: TOKEN }))).resolves.toEqual({ outcome: "INVALID" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("expiré ou déjà servi : refus, rien n'est écrit", async () => {
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue(row({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(confirmEmailAddress({ outcome: null }, form({ token: TOKEN }))).resolves.toEqual({ outcome: "EXPIRED" });
    prismaMock.emailVerificationToken.findUnique.mockResolvedValue(row({ usedAt: new Date() }));
    await expect(confirmEmailAddress({ outcome: null }, form({ token: TOKEN }))).resolves.toEqual({ outcome: "USED" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("deux clics simultanés : le second perd la course et n'écrit rien", async () => {
    tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(confirmEmailAddress({ outcome: null }, form({ token: TOKEN }))).resolves.toEqual({ outcome: "USED" });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("resendVerificationLink", () => {
  const neutral = { status: "DONE", message: RESEND_NEUTRAL_MESSAGE, disclosure: { emailNotSentLocally: false, devConfirmationPath: null } };

  it("compte en attente : un nouveau lien part APRÈS la réponse, les anciens sont clos", async () => {
    await expect(resendVerificationLink({ status: "IDLE" }, form({ email: "Direction@Glycines.example.org" }))).resolves.toEqual(neutral);
    expect(after).toHaveBeenCalledTimes(1);
    const task = after.mock.calls[0]![0] as () => Promise<unknown>;
    await task();
    expect(tx.emailVerificationToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1", usedAt: null } }));
    expect(tx.emailVerificationToken.create).toHaveBeenCalledTimes(1);
    expect(sendEmailConfirmationEmail).toHaveBeenCalledWith(expect.objectContaining({ email: "direction@glycines.example.org" }));
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("glycines.example.org");
  });

  it.each([
    ["adresse inconnue", null],
    ["déjà confirmée", pendingUser({ emailVerifiedAt: new Date() })],
    ["compte cabinet", pendingUser({ prospectAccount: null })],
    ["compte désactivé", pendingUser({ isActive: false })],
  ])("%s : même réponse, rien n'est émis", async (_label, user) => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    await expect(resendVerificationLink({ status: "IDLE" }, form({ email: "x@example.org" }))).resolves.toEqual(neutral);
    expect(after).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("développement sans service d'e-mail : lien émis tout de suite et montré", async () => {
    env.isDevelopment = true;
    env.resend = null;
    const state = await resendVerificationLink({ status: "IDLE" }, form({ email: "direction@glycines.example.org" }));
    expect(after).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "DONE", disclosure: { emailNotSentLocally: true } });
    if (state.status !== "DONE") throw new Error("attendu DONE");
    expect(state.disclosure.devConfirmationPath).toMatch(/^\/confirmer-email\/[A-Za-z0-9_-]{43}$/);
  });

  it("production sans service d'e-mail : jamais de lien à l'écran", async () => {
    env.isDevelopment = false;
    env.resend = null;
    const state = await resendVerificationLink({ status: "IDLE" }, form({ email: "direction@glycines.example.org" }));
    expect(state).toMatchObject({ status: "DONE", disclosure: { devConfirmationPath: null } });
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("adresse invalide : refus sans lecture", async () => {
    await expect(resendVerificationLink({ status: "IDLE" }, form({ email: "nope" }))).resolves.toMatchObject({ status: "ERROR" });
    expect(consumeThrottledAttempt).not.toHaveBeenCalled();
  });

  it("débit dépassé (IP puis adresse) : refus avant toute lecture", async () => {
    consumeThrottledAttempt.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(resendVerificationLink({ status: "IDLE" }, form({ email: "a@example.org" }))).resolves.toMatchObject({ status: "ERROR" });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(consumeThrottledAttempt.mock.calls.map((c) => (c[0] as { key: string }).key)).toEqual([
      "verify-resend:ip:203.0.113.9",
      "verify-resend:email:a@example.org",
    ]);
  });
});
