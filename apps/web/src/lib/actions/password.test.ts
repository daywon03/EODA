import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS du changement de mot de passe (D7) : mot de passe actuel faux,
// nouveau mot de passe trop court, limitation de débit atteinte. Le chemin nominal
// est vérifié aussi, pour prouver que la rotation efface bien le drapeau et pose
// l'horodatage de révocation.
//
// La politique de mot de passe n'est PAS simulée : password-policy est exécuté pour
// de vrai. Seules les frontières (base, session, bcrypt, compteur, journal) sont
// doublées.

const prismaMock = {
  user: { findUnique: vi.fn(), update: vi.fn() },
};

const requirePasswordRotationSession = vi.fn();
const recordAuditEvent = vi.fn();
const consumeThrottledAttempt = vi.fn();
const bcryptCompare = vi.fn();
const bcryptHash = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock("@/lib/auth/guards", () => ({
  requirePasswordRotationSession: () => requirePasswordRotationSession(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/attempt-throttle", () => ({
  consumeThrottledAttempt: (...args: unknown[]) => consumeThrottledAttempt(...args),
}));
vi.mock("bcryptjs", () => ({
  default: {
    compare: (...args: unknown[]) => bcryptCompare(...args),
    hash: (...args: unknown[]) => bcryptHash(...args),
  },
}));

const { changePasswordAction } = await import("./password");

const USER_ID = "user-1";
// Même marqueur anglais que password-policy.test.ts — voir le commentaire là-bas.
const CURRENT = "placeholder-ancien-not-a-real-secret";
const NEW = "placeholder-nouveau-not-a-real-secret";

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePasswordRotationSession.mockResolvedValue({
    userId: USER_ID,
    session: { user: { id: USER_ID, role: "CLIENT_USER" } },
    mustChangePassword: true,
  });
  consumeThrottledAttempt.mockResolvedValue(true);
  prismaMock.user.findUnique.mockResolvedValue({
    passwordHash: "$2a$12$empreinte",
    role: "CLIENT_USER",
  });
  prismaMock.user.update.mockResolvedValue({});
  bcryptCompare.mockResolvedValue(true);
  bcryptHash.mockResolvedValue("$2a$12$nouvelle-empreinte");
});

describe("changePasswordAction — cas de refus", () => {
  it("refuse un mot de passe actuel incorrect, sans toucher au compte", async () => {
    bcryptCompare.mockResolvedValue(false);

    const result = await changePasswordAction(
      formData({ currentPassword: "faux", newPassword: NEW, confirmation: NEW })
    );

    expect(result).toEqual({ error: "Le mot de passe actuel est incorrect." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PASSWORD_CHANGE_FAILED", actorUserId: USER_ID })
    );
  });

  it("ne journalise jamais le mot de passe saisi", async () => {
    bcryptCompare.mockResolvedValue(false);
    await changePasswordAction(
      formData({ currentPassword: "faux", newPassword: NEW, confirmation: NEW })
    );
    const logged = JSON.stringify(recordAuditEvent.mock.calls);
    expect(logged).not.toContain("faux");
    expect(logged).not.toContain(NEW);
  });

  it("refuse un nouveau mot de passe trop court avant même de lire le compte", async () => {
    const result = await changePasswordAction(
      formData({ currentPassword: CURRENT, newPassword: "court", confirmation: "court" })
    );

    expect(result).toEqual({ error: expect.stringContaining("12 caractères") });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse une confirmation qui ne correspond pas", async () => {
    const result = await changePasswordAction(
      formData({ currentPassword: CURRENT, newPassword: NEW, confirmation: `${NEW}-autre` })
    );

    expect(result).toEqual({ error: expect.stringContaining("confirmation") });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse quand la limitation de débit est atteinte, AVANT toute comparaison bcrypt", async () => {
    consumeThrottledAttempt.mockResolvedValue(false);

    const result = await changePasswordAction(
      formData({ currentPassword: CURRENT, newPassword: NEW, confirmation: NEW })
    );

    expect(result).toEqual({ error: expect.stringContaining("Trop de tentatives") });
    expect(bcryptCompare).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("applique la politique de limitation dédiée au changement de mot de passe", async () => {
    await changePasswordAction(
      formData({ currentPassword: CURRENT, newPassword: NEW, confirmation: NEW })
    );

    expect(consumeThrottledAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: { limit: 5, windowSeconds: 900 },
        auditAction: "PASSWORD_CHANGE_RATE_LIMITED",
      })
    );
  });
});

describe("changePasswordAction — cas nominal", () => {
  it("efface le drapeau de rotation et pose l'horodatage de révocation", async () => {
    const result = await changePasswordAction(
      formData({ currentPassword: CURRENT, newPassword: NEW, confirmation: NEW })
    );

    expect(result).toEqual({ success: true });
    expect(bcryptHash).toHaveBeenCalledWith(NEW, 12);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        passwordHash: "$2a$12$nouvelle-empreinte",
        mustChangePassword: false,
        passwordChangedAt: expect.any(Date),
      },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PASSWORD_CHANGED", actorUserId: USER_ID })
    );
  });
});
