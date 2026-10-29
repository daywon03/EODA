import { beforeEach, describe, expect, it, vi } from "vitest";

// Actions de la tablette (lot C, décision 7) : la connexion exige un appareil
// enregistré, compte les échecs et bloque au 5e ; la gestion des appareils et des
// codes est réservée à la structure, dans SON périmètre.

const prismaMock = {
  establishment: { findUniqueOrThrow: vi.fn() },
  deviceEnrollment: { create: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  staffMember: { findFirst: vi.fn(), findMany: vi.fn() },
  staffPin: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
};
const consumeThrottledAttempt = vi.fn();
vi.mock("@/lib/security/attempt-throttle", () => ({ consumeThrottledAttempt: (o: unknown) => consumeThrottledAttempt(o) }));
const cookieSet = vi.fn();
const cookieDelete = vi.fn();
const guards = { requireEstablishmentAccess: vi.fn(), resolveTabletDevice: vi.fn() };
const audit = vi.fn();
class NotFoundError extends Error {}

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, delete: cookieDelete }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("@/lib/auth/guards", () => guards);
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: audit }));
vi.mock("@/lib/config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/env")>()),
  getEnv: () => ({ authSecret: "a".repeat(32), isProduction: true }),
}));

const { enrollThisDevice, getTabletAdmin, revokeDevice, setStaffPin, tabletSignIn, tabletSignOut, unlockStaffPin } = await import("./tablet");
const { hashPin } = await import("@/lib/security/tablet-pin");
const { DEVICE_COOKIE, TABLET_SESSION_COOKIE } = await import("@/lib/security/tablet-session");

const CLIENT_ACCESS = { establishmentId: "etab-1", userId: "user-1", isClient: true, session: { user: { role: "CLIENT_USER" } } };
const DEVICE = { deviceEnrollmentId: "device-1", tenantId: "tenant-1", establishmentId: "etab-1", establishmentName: "SAD (fictif)" };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(entries)) data.set(k, v);
  return data;
}

let PIN_HASH = "";
beforeEach(async () => {
  vi.clearAllMocks();
  PIN_HASH ||= await hashPin("284719");
  guards.requireEstablishmentAccess.mockResolvedValue(CLIENT_ACCESS);
  guards.resolveTabletDevice.mockResolvedValue(DEVICE);
  prismaMock.establishment.findUniqueOrThrow.mockResolvedValue({ tenantId: "tenant-1" });
  prismaMock.staffMember.findFirst.mockResolvedValue({ id: "staff-1", pin: { pinHash: PIN_HASH, failedAttempts: 0, lockedAt: null } });
  consumeThrottledAttempt.mockResolvedValue(true);
  // L'essai réservé : le compteur vaut 1 après l'incrément.
  prismaMock.staffPin.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.staffPin.findUniqueOrThrow.mockResolvedValue({ failedAttempts: 1 });
});

describe("tabletSignIn", () => {
  it("jamais un code seul : refuse sur un appareil non enregistré", async () => {
    guards.resolveTabletDevice.mockResolvedValue(null);
    expect(await tabletSignIn(form({ staffMemberId: "staff-1", pin: "284719" }))).toEqual({
      error: "Cette tablette n'est pas enregistrée par la direction.",
    });
    expect(prismaMock.staffMember.findFirst).not.toHaveBeenCalled();
  });

  it("ouvre une session httpOnly courte avec le bon code", async () => {
    expect(await tabletSignIn(form({ staffMemberId: "staff-1", pin: "284719" }))).toEqual({ ok: true });
    expect(cookieSet).toHaveBeenCalledWith(TABLET_SESSION_COOKIE, expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "strict", secure: true }));
    expect(prismaMock.staffMember.findFirst.mock.calls[0]![0].where).toEqual({ id: "staff-1", establishmentId: "etab-1", active: true });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "TABLET_SIGNED_IN" }));
  });

  it("réserve l'essai par un incrément ATOMIQUE avant de comparer, puis bloque au 5e et le dit", async () => {
    expect(await tabletSignIn(form({ staffMemberId: "staff-1", pin: "111112" }))).toEqual({ error: "Code incorrect. Encore 4 essais." });
    expect(prismaMock.staffPin.updateMany).toHaveBeenCalledWith({
      where: { staffMemberId: "staff-1", lockedAt: null, failedAttempts: { lt: 5 } },
      data: { failedAttempts: { increment: 1 } },
    });
    prismaMock.staffPin.findUniqueOrThrow.mockResolvedValue({ failedAttempts: 5 });
    const fifth = await tabletSignIn(form({ staffMemberId: "staff-1", pin: "111112" }));
    expect(fifth).toEqual({ error: "Code bloqué après 5 essais. Demandez à la direction de le débloquer." });
    expect(prismaMock.staffPin.updateMany).toHaveBeenLastCalledWith({ where: { staffMemberId: "staff-1", lockedAt: null }, data: { lockedAt: expect.any(Date) } });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "TABLET_PIN_LOCKED" }));
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("requêtes parallèles : plus aucun essai réservable → bloqué SANS comparer le code", async () => {
    prismaMock.staffPin.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    expect(await tabletSignIn(form({ staffMemberId: "staff-1", pin: "284719" }))).toEqual({ error: "Code bloqué après 5 essais. Demandez à la direction de le débloquer." });
    expect(prismaMock.staffPin.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("débit par appareil, tous salariés confondus : au-delà, plus aucun essai", async () => {
    consumeThrottledAttempt.mockResolvedValue(false);
    expect(await tabletSignIn(form({ staffMemberId: "staff-1", pin: "284719" }))).toEqual({ error: "Trop d'essais sur cette tablette. Réessayez dans quelques minutes." });
    expect(consumeThrottledAttempt).toHaveBeenCalledWith(expect.objectContaining({ key: "tablet-pin:device-1" }));
    expect(prismaMock.staffPin.updateMany).not.toHaveBeenCalled();
  });

  it("bon code : le compteur revient à zéro", async () => {
    expect(await tabletSignIn(form({ staffMemberId: "staff-1", pin: "284719" }))).toEqual({ ok: true });
    expect(prismaMock.staffPin.update).toHaveBeenCalledWith({ where: { staffMemberId: "staff-1" }, data: { failedAttempts: 0, lockedAt: null } });
  });

  it("répond pareil pour un salarié inconnu ou sans code", async () => {
    prismaMock.staffMember.findFirst.mockResolvedValue(null);
    expect(await tabletSignIn(form({ staffMemberId: "x", pin: "284719" }))).toEqual({ error: "Code incorrect." });
  });

  it("se déconnecte en effaçant la session", async () => {
    await tabletSignOut();
    expect(cookieDelete).toHaveBeenCalledWith(TABLET_SESSION_COOKIE);
  });
});

describe("appareils et codes — côté structure", () => {
  it("enregistre CET appareil : empreinte en base, jeton en cookie httpOnly", async () => {
    prismaMock.deviceEnrollment.create.mockResolvedValue({ id: "device-9" });
    expect(await enrollThisDevice(form({ establishmentId: "etab-1", label: "Tablette du bureau" }))).toEqual({ ok: true });
    const data = prismaMock.deviceEnrollment.create.mock.calls[0]![0].data;
    const cookieValue = cookieSet.mock.calls[0]![1] as string;
    expect(cookieSet.mock.calls[0]![0]).toBe(DEVICE_COOKIE);
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.tokenHash).not.toBe(cookieValue);
    expect(data).toMatchObject({ tenantId: "tenant-1", establishmentId: "etab-1", enrolledByUserId: "user-1" });
  });

  it("refuse un identifiant de structure absent (introuvable) et le cabinet (la structure gère ses tablettes)", async () => {
    await expect(enrollThisDevice(form({ label: "x" }))).rejects.toBeInstanceOf(NotFoundError);
    guards.requireEstablishmentAccess.mockResolvedValue({ ...CLIENT_ACCESS, isClient: false });
    await expect(enrollThisDevice(form({ establishmentId: "etab-1", label: "x" }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propage le refus de la garde (non autorisé)", async () => {
    guards.requireEstablishmentAccess.mockRejectedValue(new NotFoundError());
    await expect(setStaffPin(form({ establishmentId: "etab-2", staffMemberId: "s", pin: "284719" }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pose un code valide, refuse un code faible ou un salarié d'une autre structure", async () => {
    expect(await setStaffPin(form({ establishmentId: "etab-1", staffMemberId: "staff-1", pin: "123456" }))).toEqual({
      error: "Le code ne doit pas être une suite (123456, 654321).",
    });
    expect(await setStaffPin(form({ establishmentId: "etab-1", staffMemberId: "staff-1", pin: "284719" }))).toEqual({ ok: true });
    const upsert = prismaMock.staffPin.upsert.mock.calls[0]![0];
    expect(upsert.create.pinHash).not.toContain("284719");
    expect(upsert.update).toMatchObject({ failedAttempts: 0, lockedAt: null });
    prismaMock.staffMember.findFirst.mockResolvedValue(null);
    expect(await setStaffPin(form({ establishmentId: "etab-1", staffMemberId: "autre", pin: "284719" }))).toEqual({ error: "Salarié introuvable." });
  });

  it("débloque un code, retire un appareil — dans le périmètre seulement", async () => {
    prismaMock.staffPin.updateMany.mockResolvedValue({ count: 1 });
    expect(await unlockStaffPin(form({ establishmentId: "etab-1", staffMemberId: "staff-1" }))).toEqual({ ok: true });
    prismaMock.staffPin.updateMany.mockResolvedValue({ count: 0 });
    expect(await unlockStaffPin(form({ establishmentId: "etab-1", staffMemberId: "staff-1" }))).toEqual({ error: "Ce salarié n'a pas encore de code." });
    prismaMock.deviceEnrollment.updateMany.mockResolvedValue({ count: 1 });
    expect(await revokeDevice(form({ establishmentId: "etab-1", deviceId: "device-1" }))).toEqual({ ok: true });
    expect(prismaMock.deviceEnrollment.updateMany.mock.calls[0]![0].where).toMatchObject({ id: "device-1", establishmentId: "etab-1" });
    prismaMock.deviceEnrollment.updateMany.mockResolvedValue({ count: 0 });
    expect(await revokeDevice(form({ establishmentId: "etab-1", deviceId: "autre" }))).toEqual({ error: "Tablette introuvable." });
  });

  it("liste appareils et codes sans jamais renvoyer une empreinte", async () => {
    prismaMock.deviceEnrollment.findMany.mockResolvedValue([{ id: "device-1", label: "Bureau", enrolledAt: new Date() }]);
    prismaMock.staffMember.findMany.mockResolvedValue([
      { id: "s1", displayName: "A (fictif)", jobTitle: "Aide", pin: null },
      { id: "s2", displayName: "B (fictif)", jobTitle: "Aide", pin: { lockedAt: new Date() } },
      { id: "s3", displayName: "C (fictif)", jobTitle: "Aide", pin: { lockedAt: null } },
    ]);
    const view = await getTabletAdmin("etab-1");
    expect(view.devices[0]!.isThisDevice).toBe(true);
    expect(view.staff.map((s) => s.pin)).toEqual(["AUCUN", "BLOQUE", "ACTIF"]);
    expect(JSON.stringify(view)).not.toContain("pinHash");
  });
});
