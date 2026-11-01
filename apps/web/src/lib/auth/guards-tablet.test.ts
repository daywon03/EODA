import { beforeEach, describe, expect, it, vi } from "vitest";

// Gardes de la TABLETTE (lot C, décision 7) : appareil enregistré + salarié actif de
// la même structure + code posé et non bloqué + session signée liée à CET appareil.

const prismaMock = {
  deviceEnrollment: { findUnique: vi.fn() },
  staffMember: { findFirst: vi.fn() },
  establishmentUser: { findMany: vi.fn() },
};
const authMock = vi.fn();
const cookieJar = new Map<string, string>();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) }),
}));
vi.mock("@/lib/config/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/env")>()),
  getEnv: () => ({ authSecret: SECRET }),
}));

const SECRET = "t".repeat(32);
const NOW = new Date("2026-10-14T10:00:00Z");
const { resolveTabletDevice, resolveTabletSession } = await import("./guards");
const { generateOneTimeToken } = await import("@/lib/security/one-time-token");
const { createTabletSessionToken, DEVICE_COOKIE, pinStamp, TABLET_SESSION_COOKIE } = await import("@/lib/security/tablet-session");

const DEVICE = {
  id: "device-1",
  tenantId: "tenant-1",
  establishmentId: "etab-1",
  revokedAt: null,
  establishment: { name: "SAD Les Glycines (fictif)" },
};

function session(staffMemberId = "staff-1", deviceEnrollmentId = "device-1", expiresAt = NOW.getTime() + 60_000): void {
  cookieJar.set(TABLET_SESSION_COOKIE, createTabletSessionToken({ staffMemberId, deviceEnrollmentId, expiresAt, pinStamp: pinStamp("hash-du-code") }, SECRET));
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieJar.clear();
  cookieJar.set(DEVICE_COOKIE, generateOneTimeToken());
  prismaMock.deviceEnrollment.findUnique.mockResolvedValue(DEVICE);
  prismaMock.staffMember.findFirst.mockResolvedValue({ id: "staff-1", displayName: "Julien (fictif)", jobTitle: "Aide à domicile", tabletRole: "INTERVENANT", pin: { lockedAt: null, pinHash: "hash-du-code" } });
});

describe("resolveTabletDevice", () => {
  it("reconnaît un appareil enregistré, par l'empreinte de son jeton", async () => {
    expect(await resolveTabletDevice()).toEqual({
      deviceEnrollmentId: "device-1",
      tenantId: "tenant-1",
      establishmentId: "etab-1",
      establishmentName: "SAD Les Glycines (fictif)",
    });
    const where = prismaMock.deviceEnrollment.findUnique.mock.calls[0]![0].where;
    expect(where.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(where.tokenHash).not.toBe(cookieJar.get(DEVICE_COOKIE));
  });

  it("refuse sans cookie, un jeton mal formé (sans lire la base), inconnu ou révoqué", async () => {
    cookieJar.delete(DEVICE_COOKIE);
    expect(await resolveTabletDevice()).toBeNull();
    cookieJar.set(DEVICE_COOKIE, "court");
    expect(await resolveTabletDevice()).toBeNull();
    expect(prismaMock.deviceEnrollment.findUnique).not.toHaveBeenCalled();
    cookieJar.set(DEVICE_COOKIE, generateOneTimeToken());
    prismaMock.deviceEnrollment.findUnique.mockResolvedValueOnce(null);
    expect(await resolveTabletDevice()).toBeNull();
    prismaMock.deviceEnrollment.findUnique.mockResolvedValueOnce({ ...DEVICE, revokedAt: NOW });
    expect(await resolveTabletDevice()).toBeNull();
  });
});

describe("resolveTabletSession — code changé (audit du 28/10/2026)", () => {
  it("un code changé ou remplacé depuis la connexion coupe la session sur-le-champ", async () => {
    session();
    prismaMock.staffMember.findFirst.mockResolvedValue({ id: "staff-1", displayName: "Julien (fictif)", pin: { lockedAt: null, pinHash: "nouveau-hash" } });
    expect(await resolveTabletSession(NOW)).toBeNull();
  });
});

describe("resolveTabletSession", () => {
  it("ouvre la session d'un salarié actif de la structure de l'appareil", async () => {
    session();
    expect(await resolveTabletSession(NOW)).toMatchObject({ staffMemberId: "staff-1", staffDisplayName: "Julien (fictif)", establishmentId: "etab-1" });
    expect(prismaMock.staffMember.findFirst.mock.calls[0]![0].where).toEqual({ id: "staff-1", establishmentId: "etab-1", active: true });
  });

  it("le rôle est relu en base ; la direction est toujours administrateur (30/10/2026)", async () => {
    session();
    expect(await resolveTabletSession(NOW)).toMatchObject({ tabletRole: "INTERVENANT" });
    session();
    prismaMock.staffMember.findFirst.mockResolvedValue({ id: "staff-1", displayName: "Julien (fictif)", jobTitle: "Directrice", tabletRole: "INTERVENANT", pin: { lockedAt: null, pinHash: "hash-du-code" } });
    expect(await resolveTabletSession(NOW)).toMatchObject({ tabletRole: "ADMINISTRATEUR" });
  });

  it("la direction et la responsable qualité connectées au portail sur ce navigateur sont administrateur — relu en base, structure de l'appareil", async () => {
    session();
    prismaMock.establishmentUser.findMany.mockResolvedValue([]);
    authMock.mockResolvedValue({ user: { id: "user-direction" } });
    expect(await resolveTabletSession(NOW)).toMatchObject({ tabletRole: "INTERVENANT" });

    for (const [accessRole, expected] of [["DIRECTION", "ADMINISTRATEUR"], ["RESPONSABLE_QUALITE", "ADMINISTRATEUR"], ["ADMINISTRATIF", "INTERVENANT"], ["INTERVENANT", "INTERVENANT"]] as const) {
      session();
      prismaMock.establishmentUser.findMany.mockResolvedValue([{ accessRole }]);
      expect(await resolveTabletSession(NOW)).toMatchObject({ tabletRole: expected });
    }
    const where = prismaMock.establishmentUser.findMany.mock.calls.at(-1)![0].where;
    expect(where).toEqual({ establishmentId: "etab-1", userId: { in: ["user-direction"] }, revokedAt: null, user: { isActive: true, role: "CLIENT_USER" } });
  });

  it("un salarié rattaché à un compte de direction est administrateur, même sans session du portail", async () => {
    session();
    authMock.mockResolvedValue(null);
    prismaMock.staffMember.findFirst.mockResolvedValue({ id: "staff-1", displayName: "Julien (fictif)", jobTitle: "Coordinateur", tabletRole: "INTERVENANT", userId: "user-rq", pin: { lockedAt: null, pinHash: "hash-du-code" } });
    prismaMock.establishmentUser.findMany.mockResolvedValue([{ accessRole: "RESPONSABLE_QUALITE" }]);
    expect(await resolveTabletSession(NOW)).toMatchObject({ tabletRole: "ADMINISTRATEUR" });
    expect(prismaMock.establishmentUser.findMany.mock.calls.at(-1)![0].where.userId).toEqual({ in: ["user-rq"] });
  });

  it("sans compte ni session du portail, aucune lecture des liens", async () => {
    session();
    authMock.mockResolvedValue(null);
    prismaMock.establishmentUser.findMany.mockClear();
    expect(await resolveTabletSession(NOW)).toMatchObject({ tabletRole: "INTERVENANT" });
    expect(prismaMock.establishmentUser.findMany).not.toHaveBeenCalled();
  });

  it("jamais un code seul : sans appareil enregistré, la session ne vaut rien", async () => {
    session();
    prismaMock.deviceEnrollment.findUnique.mockResolvedValueOnce(null);
    expect(await resolveTabletSession(NOW)).toBeNull();
  });

  it("refuse une session absente, expirée, ou ouverte sur un autre appareil", async () => {
    expect(await resolveTabletSession(NOW)).toBeNull();
    session("staff-1", "device-1", NOW.getTime() - 1);
    expect(await resolveTabletSession(NOW)).toBeNull();
    session("staff-1", "device-2");
    expect(await resolveTabletSession(NOW)).toBeNull();
  });

  it("refuse un salarié parti, d'une autre structure, sans code ou bloqué", async () => {
    session();
    prismaMock.staffMember.findFirst.mockResolvedValueOnce(null);
    expect(await resolveTabletSession(NOW)).toBeNull();
    prismaMock.staffMember.findFirst.mockResolvedValueOnce({ id: "staff-1", displayName: "x", pin: null });
    expect(await resolveTabletSession(NOW)).toBeNull();
    prismaMock.staffMember.findFirst.mockResolvedValueOnce({ id: "staff-1", displayName: "x", pin: { lockedAt: NOW } });
    expect(await resolveTabletSession(NOW)).toBeNull();
  });
});
