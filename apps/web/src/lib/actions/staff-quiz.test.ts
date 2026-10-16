import { beforeEach, describe, expect, it, vi } from "vitest";

// Équipe et quiz côté portails : garde TEAM_*, intervenant limité à sa ligne,
// campagne qui ne stocke que des empreintes et ignore les salariés d'ailleurs,
// alerte d'échéance idempotente, émargement journalisé.

class NotFoundError extends Error {}

const tx = { quizCampaign: { create: vi.fn() }, quizInvitation: { createMany: vi.fn() } };
const prismaMock = {
  staffMember: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn() },
  quizAttempt: { findMany: vi.fn() },
  actionItem: { findMany: vi.fn(), create: vi.fn() },
  establishment: { findUniqueOrThrow: vi.fn() },
  $transaction: vi.fn((run: (t: typeof tx) => unknown) => run(tx)),
};
const requireEstablishmentAccess = vi.fn();
const tryEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: unknown[]) => requireEstablishmentAccess(...args),
  tryEstablishmentAccess: (...args: unknown[]) => tryEstablishmentAccess(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/config/app-url", () => ({ appUrl: (p: string) => `https://portail.example.org${p}` }));

const { getQuizBoard, syncQuizRetestTasks } = await import("./staff-quiz");
const { addStaffMember, exportQuizSignoff, markStaffMemberLeft, sendQuizCampaign } = await import("./staff-quiz-write");

function access(overrides: Record<string, unknown> = {}) {
  return {
    establishmentId: "e-1",
    userId: "u-1",
    isClient: false,
    ownOnly: false,
    missionAccess: "ACTIVE",
    session: { user: { role: "CABINET_ADMIN" } },
    ...overrides,
  };
}

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
}

const NOW = new Date(2026, 9, 13);

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue(access());
  tryEstablishmentAccess.mockResolvedValue(access());
  prismaMock.staffMember.findMany.mockResolvedValue([{ id: "s1", displayName: "Personne (fictive)", jobTitle: "Aide" }]);
  prismaMock.quizAttempt.findMany.mockResolvedValue([]);
  prismaMock.establishment.findUniqueOrThrow.mockResolvedValue({ tenantId: "t-1", name: "SAD Les Glycines (fictif)" });
  tx.quizCampaign.create.mockResolvedValue({ id: "camp-1" });
  prismaMock.actionItem.create.mockResolvedValue({ id: "task-1" });
});

describe("getQuizBoard", () => {
  it("se lit avec le module TEAM en lecture et calcule la matrice", async () => {
    const board = await getQuizBoard("e-1", NOW);
    expect(requireEstablishmentAccess).toHaveBeenCalledWith("e-1", { module: "TEAM", mode: "READ" });
    expect(board.rows).toHaveLength(1);
    expect(board.tiles).toHaveLength(5);
    expect(board.canWrite).toBe(true);
  });

  it("intervenant (OWN) : sa propre fiche seulement, aucun geste", async () => {
    requireEstablishmentAccess.mockResolvedValue(access({ isClient: true, ownOnly: true }));
    const board = await getQuizBoard("e-1", NOW);
    expect(prismaMock.staffMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "u-1" }) })
    );
    expect(board.canWrite).toBe(false);
  });

  it("lecture seule : la garde d'écriture refuse, pas de gestes", async () => {
    tryEstablishmentAccess.mockResolvedValue(null);
    expect((await getQuizBoard("e-1", NOW)).canWrite).toBe(false);
  });

  it("refus de la garde (autre tenant, structure non affectée) : propagé", async () => {
    requireEstablishmentAccess.mockRejectedValue(new NotFoundError());
    await expect(getQuizBoard("e-x", NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("syncQuizRetestTasks — alerte D12", () => {
  const passedFiveMonthsAgo = [{ staffMemberId: "s1", moduleCode: "BIENTRAITANCE", passed: true, completedAt: new Date(2026, 4, 1) }];

  it("crée une tâche QUIZ quand un rappel tombe dans les 30 jours", async () => {
    prismaMock.quizAttempt.findMany.mockResolvedValue(passedFiveMonthsAgo);
    prismaMock.actionItem.findMany.mockResolvedValue([]);
    await expect(syncQuizRetestTasks("e-1", NOW)).resolves.toBe(1);
    expect(prismaMock.actionItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: "QUIZ", ownerKind: "STRUCTURE", establishmentId: "e-1" }),
      select: { id: true },
    });
    expect(requireEstablishmentAccess).toHaveBeenCalledWith("e-1", { module: "TEAM", mode: "WRITE" });
  });

  it("idempotente : une tâche ouverte de même titre suffit", async () => {
    prismaMock.quizAttempt.findMany.mockResolvedValue(passedFiveMonthsAgo);
    prismaMock.actionItem.findMany.mockResolvedValue([
      { title: "Faire refaire le quiz « Bientraitance » aux personnes à rappeler" },
    ]);
    await expect(syncQuizRetestTasks("e-1", NOW)).resolves.toBe(0);
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("rien pour un intervenant", async () => {
    requireEstablishmentAccess.mockResolvedValue(access({ isClient: true, ownOnly: true }));
    await expect(syncQuizRetestTasks("e-1", NOW)).resolves.toBe(0);
  });
});

describe("sendQuizCampaign", () => {
  it("crée la campagne, n'écrit que des empreintes, rend lien et QR une fois", async () => {
    const result = await sendQuizCampaign(form({ establishmentId: "e-1", moduleCode: "PLAINTES", staffMemberIds: ["s1", "s-ailleurs"] }));
    expect(prismaMock.staffMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ establishmentId: "e-1", active: true }) })
    );
    if ("error" in result) throw new Error(result.error);
    expect(result.invitations).toHaveLength(1);
    const invitation = result.invitations[0];
    expect(invitation?.url).toMatch(/^https:\/\/portail\.example\.org\/quiz\/[A-Za-z0-9_-]{43}$/);
    const token = invitation?.url.split("/").pop() ?? "";
    const written = JSON.stringify(tx.quizInvitation.createMany.mock.calls);
    expect(written).not.toContain(token);
    expect(written).toMatch(/"tokenHash":"[0-9a-f]{64}"/);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "QUIZ_CAMPAIGN_SENT" }));
  });

  it("refuse un module inconnu, une liste vide, un intervenant, un accompagnement clos", async () => {
    await expect(sendQuizCampaign(form({ establishmentId: "e-1", moduleCode: "INCONNU", staffMemberIds: "s1" }))).resolves.toEqual({
      error: "Choisissez un quiz.",
    });
    await expect(sendQuizCampaign(form({ establishmentId: "e-1", moduleCode: "PLAINTES" }))).resolves.toMatchObject({ error: expect.any(String) });
    requireEstablishmentAccess.mockResolvedValue(access({ isClient: true, ownOnly: true }));
    await expect(sendQuizCampaign(form({ establishmentId: "e-1", moduleCode: "PLAINTES", staffMemberIds: "s1" }))).resolves.toMatchObject({
      error: expect.any(String),
    });
    requireEstablishmentAccess.mockResolvedValue(access({ isClient: true, missionAccess: "LIBRARY" }));
    await expect(sendQuizCampaign(form({ establishmentId: "e-1", moduleCode: "PLAINTES", staffMemberIds: "s1" }))).resolves.toMatchObject({
      error: expect.stringContaining("clos"),
    });
    expect(tx.quizCampaign.create).not.toHaveBeenCalled();
  });
});

describe("fiches salarié et émargement", () => {
  it("ajoute une fiche sans compte, journalise sans nom", async () => {
    prismaMock.staffMember.create.mockResolvedValue({ id: "s2" });
    await expect(addStaffMember(form({ establishmentId: "e-1", displayName: "Fatou D. (fictive)", jobTitle: "Aide à domicile" }))).resolves.toBeNull();
    expect(prismaMock.staffMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "t-1", establishmentId: "e-1" }) })
    );
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("Fatou");
  });

  it("un départ désactive la fiche ; une fiche d'une autre structure est introuvable", async () => {
    prismaMock.staffMember.findFirst.mockResolvedValue({ id: "s1" });
    await expect(markStaffMemberLeft("e-1", "s1")).resolves.toBeNull();
    expect(prismaMock.staffMember.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { active: false, leftAt: expect.any(Date) } });
    prismaMock.staffMember.findFirst.mockResolvedValue(null);
    await expect(markStaffMemberLeft("e-1", "ailleurs")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("exporte les réussites, nommées selon la convention EODA, et journalise la sortie", async () => {
    prismaMock.quizAttempt.findMany.mockResolvedValue([
      { moduleCode: "PLAINTES", moduleVersion: 1, score: 7, total: 7, completedAt: NOW, staffMember: { displayName: "P (fictive)", jobTitle: "Aide" } },
    ]);
    const { fileName, content } = await exportQuizSignoff("e-1");
    expect(fileName).toMatch(/^\d{8}_EMARGEMENT_.+_v01_Externe\.csv$/);
    expect(content).toContain("Plaintes et réclamations");
    expect(prismaMock.quizAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ passed: true, establishmentId: "e-1" }) })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "QUIZ_SIGNOFF_EXPORTED" }));
  });
});
