import { beforeEach, describe, expect, it, vi } from "vitest";

// Gestes de la DIRECTION sur les accès de SA structure (N9).

class NotFoundError extends Error {}

const tx = {
  user: { create: vi.fn(), update: vi.fn() },
  establishmentUser: { create: vi.fn(), update: vi.fn(), count: vi.fn() },
};
const prismaMock = {
  user: { findUnique: vi.fn() },
  establishmentUser: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn((run: (t: typeof tx) => unknown) => run(tx)),
};
const requireClientEstablishment = vi.fn();
const recordAuditEvent = vi.fn();
const sendClientInvitationEmail = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  EstablishmentUserRole: { DIRECTEUR: "DIRECTEUR", COORDINATEUR: "COORDINATEUR", AUTRE: "AUTRE" },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireClientEstablishment: (need: unknown) => requireClientEstablishment(need) }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/password-hashing", () => ({
  generateTemporaryPassword: () => "placeholder-jetable-not-a-real-secret",
  hashPassword: () => Promise.resolve("empreinte"),
}));
vi.mock("@/lib/email/notifications", () => ({
  sendClientInvitationEmail: (...args: unknown[]) => sendClientInvitationEmail(...args),
}));

const { changeClientAccessRole, getStructureAccesses, grantClientAccess, revokeClientAccess } = await import(
  "./client-access"
);

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const LINKS = [
  { userId: "dir-1", accessRole: "DIRECTION", revokedAt: null },
  { userId: "rq-1", accessRole: "RESPONSABLE_QUALITE", revokedAt: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  requireClientEstablishment.mockResolvedValue({
    establishment: { id: "etab-1", name: "SAD Les Glycines (fictif)" },
    userId: "dir-1",
    missionAccess: "ACTIVE",
  });
  prismaMock.establishmentUser.findMany.mockResolvedValue(LINKS);
  prismaMock.user.findUnique.mockResolvedValue(null);
  tx.user.create.mockResolvedValue({ id: "nouveau" });
  tx.establishmentUser.count.mockResolvedValue(0);
  sendClientInvitationEmail.mockResolvedValue("SENT");
});

describe("grantClientAccess", () => {
  it("passe par la garde du module ACCESS en écriture", async () => {
    await grantClientAccess(form({ name: "X", email: "x@example.org", roleInEstablishment: "AUTRE", accessRole: "INTERVENANT" }));
    expect(requireClientEstablishment).toHaveBeenCalledWith({ module: "ACCESS", mode: "WRITE" });
  });

  it("crée le compte et le lien sur SA structure, avec le rôle choisi, et journalise", async () => {
    const result = await grantClientAccess(
      form({ name: "Intervenante (fictive)", email: "i@example.org", roleInEstablishment: "AUTRE", accessRole: "INTERVENANT" })
    );
    expect(result).toMatchObject({ success: true, invitationDelivery: "SENT" });
    expect(tx.establishmentUser.create).toHaveBeenCalledWith({
      data: { userId: "nouveau", establishmentId: "etab-1", roleInEstablishment: "AUTRE", accessRole: "INTERVENANT" },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "CLIENT_ACCESS_GRANTED", detail: "INTERVENANT" }));
  });

  it("refuse un rôle « EODA » ou inconnu", async () => {
    const result = await grantClientAccess(form({ name: "X", email: "x@example.org", roleInEstablishment: "AUTRE", accessRole: "EODA" }));
    expect(result).toEqual({ error: "Choisissez un rôle." });
  });

  it("refuse quand l'accompagnement est clos", async () => {
    requireClientEstablishment.mockResolvedValue({
      establishment: { id: "etab-1", name: "SAD (fictif)" },
      userId: "dir-1",
      missionAccess: "LIBRARY",
    });
    const result = await grantClientAccess(form({ name: "X", email: "x@example.org", roleInEstablishment: "AUTRE", accessRole: "INTERVENANT" }));
    expect(result).toMatchObject({ error: expect.stringContaining("clos") });
  });
});

describe("changeClientAccessRole / revokeClientAccess", () => {
  it("change le rôle d'une personne de la structure", async () => {
    prismaMock.establishmentUser.findUnique.mockResolvedValue({ ...LINKS[1], user: { role: "CLIENT_USER" } });
    await expect(changeClientAccessRole(form({ userId: "rq-1", accessRole: "ADMINISTRATIF" }))).resolves.toBeNull();
    expect(prismaMock.establishmentUser.update).toHaveBeenCalledWith({
      where: { userId_establishmentId: { userId: "rq-1", establishmentId: "etab-1" } },
      data: { accessRole: "ADMINISTRATIF" },
    });
  });

  it("une personne d'une autre structure est introuvable", async () => {
    prismaMock.establishmentUser.findUnique.mockResolvedValue(null);
    await expect(revokeClientAccess("ailleurs")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("retire l'accès sans rien supprimer, et désactive un compte sans autre lien actif", async () => {
    prismaMock.establishmentUser.findUnique.mockResolvedValue({ ...LINKS[1], user: { role: "CLIENT_USER" } });
    await expect(revokeClientAccess("rq-1")).resolves.toBeNull();
    expect(tx.establishmentUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { revokedAt: expect.any(Date) } })
    );
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "rq-1" }, data: expect.objectContaining({ isActive: false }) })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "CLIENT_ACCESS_REVOKED" }));
  });

  it("protège la dernière direction et son propre accès", async () => {
    prismaMock.establishmentUser.findUnique.mockResolvedValue({ ...LINKS[0], user: { role: "CLIENT_USER" } });
    await expect(revokeClientAccess("dir-1")).resolves.toMatchObject({ error: expect.any(String) });
    expect(tx.establishmentUser.update).not.toHaveBeenCalled();
  });
});

describe("getStructureAccesses", () => {
  it("se lit avec le module ACCESS, et liste les comptes clients de la structure", async () => {
    prismaMock.establishmentUser.findMany.mockResolvedValue([
      {
        accessRole: "DIRECTION",
        revokedAt: null,
        roleInEstablishment: "DIRECTEUR",
        user: { id: "dir-1", name: "Direction (fictive)", email: "d@example.org", isActive: true, mustChangePassword: false, role: "CLIENT_USER" },
      },
    ]);
    const data = await getStructureAccesses();
    expect(requireClientEstablishment).toHaveBeenCalledWith({ module: "ACCESS", mode: "READ" });
    expect(data?.rows).toEqual([expect.objectContaining({ userId: "dir-1", status: "ACTIVE", isSelf: true })]);
  });
});
