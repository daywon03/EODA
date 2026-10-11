import { beforeEach, describe, expect, it, vi } from "vitest";

// « Un compte existe déjà » (bilan §3.2) : dire OÙ seulement dans le même cabinet, et
// permettre de RATTACHER le compte existant — geste cabinet, gardé, journalisé.

const prismaMock = {
  establishment: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  establishmentUser: { create: vi.fn() },
  $transaction: vi.fn(),
};
const requireEstablishmentInTenant = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  EstablishmentUserRole: { DIRECTEUR: "DIRECTEUR", AUTRE: "AUTRE" },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (id: string) => requireEstablishmentInTenant(id),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/password-hashing", () => ({
  generateTemporaryPassword: () => "placeholder-jetable-not-a-real-secret",
  hashPassword: () => Promise.resolve("empreinte"),
}));
vi.mock("@/lib/email/notifications", () => ({ sendClientInvitationEmail: vi.fn(() => Promise.resolve(true)) }));

const { inviteClientUser, linkExistingClientUser } = await import("./user");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const INVITE = form({
  establishmentId: "etab-cible",
  email: "directeur@example.org",
  name: "Direction Test",
  roleInEstablishment: "DIRECTEUR",
});
const LINK = form({ establishmentId: "etab-cible", email: "directeur@example.org", roleInEstablishment: "DIRECTEUR" });

function existingAccount(tenantIds: string[], extra: Partial<{ role: string; isActive: boolean }> = {}) {
  return {
    id: "user-existant",
    role: "CLIENT_USER",
    isActive: true,
    establishmentUsers: tenantIds.map((tenantId, i) => ({
      establishmentId: `etab-${i}`,
      establishment: { name: `SAD fictif ${i}`, tenantId },
    })),
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({
    establishmentId: "etab-cible",
    tenantId: "t-1",
    userId: "u-cabinet",
    session: { user: { id: "u-cabinet", role: "CABINET_ADMIN" } },
  });
  prismaMock.establishment.findUnique.mockResolvedValue({ name: "SAD Les Glycines (fictif)" });
});

describe("inviteClientUser — compte existant", () => {
  it("même cabinet : dit où, et rend l'adresse rattachable", async () => {
    prismaMock.user.findUnique.mockResolvedValue(existingAccount(["t-1"]));
    const result = await inviteClientUser(INVITE);
    expect(result).toMatchObject({ linkableEmail: "directeur@example.org" });
    expect("error" in result && result.error).toContain("SAD fictif 0");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("autre cabinet : phrase opaque, aucun nom, rien de rattachable", async () => {
    prismaMock.user.findUnique.mockResolvedValue(existingAccount(["t-1", "t-2"]));
    const result = await inviteClientUser(INVITE);
    expect(result).toEqual({ error: "Un compte existe déjà pour cette adresse email." });
  });

  it("refuse une structure d'un autre cabinet avant toute lecture (garde)", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(inviteClientUser(INVITE)).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("linkExistingClientUser", () => {
  it("rattache un compte du même cabinet, sans toucher au mot de passe, et le journalise", async () => {
    prismaMock.user.findUnique
      .mockResolvedValueOnce(existingAccount(["t-1"]))
      .mockResolvedValueOnce({ id: "user-existant" });

    const result = await linkExistingClientUser(LINK);

    expect(result).toEqual({ success: true });
    expect(prismaMock.establishmentUser.create).toHaveBeenCalledWith({
      data: { userId: "user-existant", establishmentId: "etab-cible", roleInEstablishment: "DIRECTEUR" },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CLIENT_USER_LINKED", targetId: "user-existant" })
    );
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("directeur@example.org");
  });

  it("refuse un compte qui touche un autre cabinet (recalcul serveur, pas confiance à l'écran)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(existingAccount(["t-2"]));
    const result = await linkExistingClientUser(LINK);
    expect(result).toEqual({ error: "Un compte existe déjà pour cette adresse email." });
    expect(prismaMock.establishmentUser.create).not.toHaveBeenCalled();
  });

  it("refuse quand aucun compte n'existe", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const result = await linkExistingClientUser(LINK);
    expect(result).toEqual({ error: "Aucun compte à rattacher pour cette adresse." });
  });

  it("refuse un compte déjà rattaché à la structure", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...existingAccount([]),
      establishmentUsers: [{ establishmentId: "etab-cible", establishment: { name: "X", tenantId: "t-1" } }],
    });
    const result = await linkExistingClientUser(LINK);
    expect(result).toEqual({ error: "Cet interlocuteur a déjà accès à cette structure." });
  });

  it("refuse sans établissement, et propage le refus de la garde", async () => {
    expect(await linkExistingClientUser(form({ email: "a@example.org" }))).toEqual({ error: "Établissement manquant." });
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(linkExistingClientUser(LINK)).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.establishmentUser.create).not.toHaveBeenCalled();
  });
});
