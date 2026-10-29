import { beforeEach, describe, expect, it, vi } from "vitest";

// Actions de l'équipe EODA : garde, tenant, invitation (mot de passe temporaire,
// e-mail rendu), dernier administrateur protégé, soi-même protégé, journalisation.

class NotFoundError extends Error {}

const prismaMock = {
  user: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  establishment: { findMany: vi.fn() },
  establishmentAssignment: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
};
const requireTeamManagerSession = vi.fn();
const recordAuditEvent = vi.fn();
const sendCabinetInvitationEmail = vi.fn();

vi.mock("@/lib/db/password-setup-tokens", () => ({ issuePasswordSetupLink: async () => "https://portail.test/definir-mot-de-passe/jeton-fictif" }));
vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireTeamManagerSession: () => requireTeamManagerSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/password-hashing", () => ({
  generateTemporaryPassword: () => "placeholder-jetable-not-a-real-secret",
  hashPassword: () => Promise.resolve("empreinte"),
}));
vi.mock("@/lib/email/notifications", () => ({
  sendCabinetInvitationEmail: (...args: unknown[]) => sendCabinetInvitationEmail(...args),
}));

const { getCabinetTeam, inviteCabinetMember, removeCabinetMemberAccess, updateCabinetMember } = await import(
  "./cabinet-team"
);

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

const TEAM = [
  { id: "admin-1", role: "CABINET_ADMIN", isActive: true },
  { id: "conso-1", role: "CABINET_EVALUATOR", isActive: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  requireTeamManagerSession.mockResolvedValue({ tenantId: "t-1", userId: "admin-1", role: "CABINET_ADMIN" });
  prismaMock.establishment.findMany.mockResolvedValue([{ id: "e1", name: "SAD Les Glycines (fictif)" }]);
  prismaMock.user.findMany.mockResolvedValue(TEAM);
  prismaMock.user.findUnique.mockResolvedValue(null);
  prismaMock.user.create.mockResolvedValue({ id: "nouveau" });
  sendCabinetInvitationEmail.mockResolvedValue("NOT_CONFIGURED");
});

describe("inviteCabinetMember", () => {
  it("crée le compte avec rotation forcée, affecte les structures d'une consultante et journalise", async () => {
    const result = await inviteCabinetMember(
      form({ name: "Consultante (fictive)", email: "conso@example.org", role: "CABINET_EVALUATOR", establishmentIds: ["e1", "e-etranger"] })
    );
    expect(result).toMatchObject({ success: true, invitationDelivery: "NOT_CONFIGURED" });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: "CABINET_EVALUATOR", tenantId: "t-1", mustChangePassword: true }),
      })
    );
    // La structure étrangère est ignorée, jamais écrite.
    expect(prismaMock.establishmentAssignment.createMany).toHaveBeenCalledWith({
      data: [{ tenantId: "t-1", establishmentId: "e1", userId: "nouveau" }],
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CABINET_USER_INVITED", targetId: "nouveau", detail: "CABINET_EVALUATOR" })
    );
    // Aucune donnée personnelle dans le journal.
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("conso@example.org");
  });

  it("refuse un rôle inconnu (pas de cast d'enum)", async () => {
    const result = await inviteCabinetMember(form({ name: "X", email: "x@example.org", role: "CLIENT_USER" }));
    expect(result).toEqual({ error: "Choisissez un rôle." });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("refuse une adresse déjà prise, sans dire par qui", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "quelquun" });
    const result = await inviteCabinetMember(form({ name: "X", email: "x@example.org", role: "CABINET_READONLY" }));
    expect(result).toEqual({ error: "Cette adresse e-mail est déjà utilisée par un compte." });
  });

  it("la garde passe AVANT toute lecture", async () => {
    requireTeamManagerSession.mockRejectedValue(new Error("REDIRECT:/dashboard/cabinet"));
    await expect(inviteCabinetMember(form({ name: "X", email: "x@example.org", role: "CABINET_ADMIN" }))).rejects.toThrow(
      "REDIRECT"
    );
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("removeCabinetMemberAccess", () => {
  it("désactive (ne supprime pas) et journalise", async () => {
    prismaMock.user.findFirst.mockResolvedValue(TEAM[1]);
    await expect(removeCabinetMemberAccess("conso-1")).resolves.toBeNull();
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "conso-1" }, data: expect.objectContaining({ isActive: false }) })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "CABINET_USER_ACCESS_REMOVED" }));
  });

  it("protège le dernier administrateur", async () => {
    requireTeamManagerSession.mockResolvedValue({ tenantId: "t-1", userId: "autre-admin", role: "CABINET_ADMIN" });
    prismaMock.user.findFirst.mockResolvedValue(TEAM[0]);
    const result = await removeCabinetMemberAccess("admin-1");
    expect(result).toEqual({ error: expect.stringContaining("dernier administrateur") });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse son propre compte", async () => {
    prismaMock.user.findFirst.mockResolvedValue(TEAM[0]);
    prismaMock.user.findMany.mockResolvedValue([...TEAM, { id: "admin-2", role: "CABINET_ADMIN", isActive: true }]);
    await expect(removeCabinetMemberAccess("admin-1")).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("un compte d'un autre cabinet est introuvable — la lecture est bornée au tenant", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(removeCabinetMemberAccess("ailleurs")).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "ailleurs", tenantId: "t-1" }) })
    );
  });
});

describe("updateCabinetMember", () => {
  it("change le rôle et journalise l'avant / après", async () => {
    prismaMock.user.findFirst.mockResolvedValue(TEAM[1]);
    await expect(updateCabinetMember(form({ userId: "conso-1", role: "CABINET_COMMERCIAL" }))).resolves.toBeNull();
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "conso-1" }, data: { role: "CABINET_COMMERCIAL" } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CABINET_USER_ROLE_CHANGED", detail: "CABINET_EVALUATOR → CABINET_COMMERCIAL" })
    );
    // Un commercial n'est affecté à aucune structure.
    expect(prismaMock.establishmentAssignment.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("refuse de rétrograder le dernier administrateur", async () => {
    requireTeamManagerSession.mockResolvedValue({ tenantId: "t-1", userId: "autre-admin", role: "CABINET_ADMIN" });
    prismaMock.user.findFirst.mockResolvedValue(TEAM[0]);
    const result = await updateCabinetMember(form({ userId: "admin-1", role: "CABINET_READONLY" }));
    expect(result).toMatchObject({ error: expect.stringContaining("dernier administrateur") });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("getCabinetTeam", () => {
  it("ne liste que les comptes cabinet du tenant de l'appelant", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "admin-1", name: "Admin (fictif)", email: "a@example.org", role: "CABINET_ADMIN", isActive: true, lastLoginAt: null, establishmentAssignments: [] },
    ]);
    const team = await getCabinetTeam();
    expect(team.members).toHaveLength(1);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "t-1" }) })
    );
  });
});
