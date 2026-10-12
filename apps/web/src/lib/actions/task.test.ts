import { beforeEach, describe, expect, it, vi } from "vitest";

// Tâches (N5) — gardes et droits : non authentifié, client d'une autre structure,
// autre cabinet, accès révoqué (la garde refuse) ; bibliothèque en lecture seule ;
// un client n'agit que sur les tâches de la structure ou les siennes ; le journal ne
// porte jamais le titre.

const prismaMock = {
  establishment: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  establishmentUser: { findMany: vi.fn() },
  actionItem: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
};
const requireEstablishmentAccess = vi.fn();
const requireCabinetSession = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  ActionOwnerKind: { CABINET: "CABINET", STRUCTURE: "STRUCTURE" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (id: string) => requireEstablishmentAccess(id),
  requireCabinetSession: () => requireCabinetSession(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { createActionItem, setActionItemDone, reassignActionItem, listEstablishmentActionItems, listMyTasksToday } =
  await import("./task");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const CABINET = { session: { user: { role: "CABINET_ADMIN" } }, userId: "eoda-1", establishmentId: "e1", isClient: false, missionAccess: "ACTIVE" };
const CLIENT = { session: { user: { role: "CLIENT_USER" } }, userId: "me", establishmentId: "e1", isClient: true, missionAccess: "ACTIVE" };

const ITEM = {
  id: "t1",
  title: "Afficher la charte",
  ownerKind: "STRUCTURE",
  ownerUserId: null,
  ownerFunction: null,
  dueOn: null,
  doneAt: null,
  source: "MANUEL",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue(CABINET);
  prismaMock.establishment.findUnique.mockResolvedValue({ tenantId: "t-1" });
  prismaMock.user.findMany.mockResolvedValue([{ id: "eoda-1", name: "Consultante Test" }]);
  prismaMock.establishmentUser.findMany.mockResolvedValue([
    { user: { id: "me", name: "Direction Test" } },
    { user: { id: "collegue", name: "Coordination Test" } },
  ]);
  prismaMock.actionItem.create.mockResolvedValue({ id: "new", source: "MANUEL", ownerKind: "STRUCTURE" });
  prismaMock.actionItem.findFirst.mockResolvedValue(ITEM);
});

describe("gardes", () => {
  it.each([
    ["non authentifié", new Error("REDIRECT")],
    ["client d'une autre structure / autre cabinet / accès révoqué", new Error("NOT_FOUND")],
  ])("%s : la garde refuse, rien n'est écrit", async (_label, error) => {
    requireEstablishmentAccess.mockRejectedValue(error);
    await expect(createActionItem(form({ establishmentId: "e1", title: "x", ownerKind: "STRUCTURE" }))).rejects.toThrow(error.message);
    await expect(setActionItemDone(form({ establishmentId: "e1", actionItemId: "t1", done: "true" }))).rejects.toThrow(error.message);
    await expect(listEstablishmentActionItems("e1")).rejects.toThrow(error.message);
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
    expect(prismaMock.actionItem.update).not.toHaveBeenCalled();
  });

  it("une tâche d'une autre structure répond introuvable (recherche bornée à la structure gardée)", async () => {
    prismaMock.actionItem.findFirst.mockResolvedValue(null);
    await expect(setActionItemDone(form({ establishmentId: "e1", actionItemId: "ailleurs", done: "true" }))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.actionItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "ailleurs", establishmentId: "e1" } }));
  });

  it("identifiants manquants : introuvable", async () => {
    await expect(setActionItemDone(form({ done: "true" }))).rejects.toThrow("NOT_FOUND");
    expect(await createActionItem(form({ title: "x" }))).toEqual({ error: "Structure manquante." });
  });
});

describe("création", () => {
  it("cabinet : crée, journalise source et côté, jamais le titre", async () => {
    const result = await createActionItem(
      form({ establishmentId: "e1", title: "  Afficher la charte  ", ownerKind: "CABINET", ownerUserId: "eoda-1", dueOn: "2026-10-20" })
    );
    expect(result).toBeNull();
    expect(prismaMock.actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "t-1", title: "Afficher la charte", ownerKind: "CABINET", ownerUserId: "eoda-1", createdByUserId: "eoda-1" }),
      })
    );
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("Afficher la charte");
  });

  it("client : ne confie pas à EODA ; bibliothèque (mission close) en lecture seule", async () => {
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    expect(await createActionItem(form({ establishmentId: "e1", title: "x", ownerKind: "CABINET" }))).toHaveProperty("error");
    requireEstablishmentAccess.mockResolvedValue({ ...CLIENT, missionAccess: "LIBRARY" });
    expect(await createActionItem(form({ establishmentId: "e1", title: "x", ownerKind: "STRUCTURE" }))).toHaveProperty("error");
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("refuse un titre vide, une personne hors structure, un responsable invalide", async () => {
    expect(await createActionItem(form({ establishmentId: "e1", title: " ", ownerKind: "STRUCTURE" }))).toHaveProperty("error");
    expect(await createActionItem(form({ establishmentId: "e1", title: "x", ownerKind: "STRUCTURE", ownerUserId: "inconnu" }))).toHaveProperty("error");
    expect(await createActionItem(form({ establishmentId: "e1", title: "x", ownerKind: "PERSONNE" }))).toHaveProperty("error");
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
  });
});

describe("cocher, décocher, réassigner", () => {
  it("cabinet coche puis décoche, chaque geste journalisé", async () => {
    expect(await setActionItemDone(form({ establishmentId: "e1", actionItemId: "t1", done: "true" }))).toBeNull();
    expect(prismaMock.actionItem.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { doneAt: expect.any(Date), doneByUserId: "eoda-1" } });
    prismaMock.actionItem.findFirst.mockResolvedValue({ ...ITEM, doneAt: new Date() });
    expect(await setActionItemDone(form({ establishmentId: "e1", actionItemId: "t1", done: "false" }))).toBeNull();
    expect(recordAuditEvent.mock.calls.map((c) => (c[0] as { action: string }).action)).toEqual([
      "ACTION_ITEM_COMPLETED",
      "ACTION_ITEM_REOPENED",
    ]);
  });

  it("client : refuse une tâche confiée à un collègue ; ne voit pas une tâche d'EODA", async () => {
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    prismaMock.actionItem.findFirst.mockResolvedValue({ ...ITEM, ownerUserId: "collegue" });
    expect(await setActionItemDone(form({ establishmentId: "e1", actionItemId: "t1", done: "true" }))).toHaveProperty("error");
    prismaMock.actionItem.findFirst.mockResolvedValue({ ...ITEM, ownerKind: "CABINET" });
    await expect(setActionItemDone(form({ establishmentId: "e1", actionItemId: "t1", done: "true" }))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.actionItem.update).not.toHaveBeenCalled();
  });

  it("valeur de « fait » invalide : refus ; inchangé : rien n'est écrit", async () => {
    expect(await setActionItemDone(form({ establishmentId: "e1", actionItemId: "t1", done: "oui" }))).toEqual({ error: "Valeur invalide." });
    expect(await setActionItemDone(form({ establishmentId: "e1", actionItemId: "t1", done: "false" }))).toBeNull();
    expect(prismaMock.actionItem.update).not.toHaveBeenCalled();
  });

  it("réassigne vers un collègue ; refuse vers EODA côté client", async () => {
    expect(await reassignActionItem(form({ establishmentId: "e1", actionItemId: "t1", ownerKind: "STRUCTURE", ownerUserId: "collegue" }))).toBeNull();
    // Réassigner, c'est choisir le responsable : une fonction posée avant (pilote
    // proposé) ne doit pas survivre et s'afficher à la place du choix fait.
    expect(prismaMock.actionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ownerKind: "STRUCTURE", ownerUserId: "collegue", ownerFunction: null } })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ACTION_ITEM_REASSIGNED", detail: "MANUEL · STRUCTURE" }));
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    expect(await reassignActionItem(form({ establishmentId: "e1", actionItemId: "t1", ownerKind: "CABINET" }))).toHaveProperty("error");
  });
});

describe("lectures", () => {
  it("client : seules les tâches de la structure, aucune personne d'EODA proposée", async () => {
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    prismaMock.actionItem.findMany.mockResolvedValue([
      { ...ITEM, linkedDocumentId: null, ownerUser: null, linkedCriterion: { code: "2.2.5" } },
      { ...ITEM, id: "t2", ownerKind: "CABINET", linkedDocumentId: null, ownerUser: null, linkedCriterion: null },
    ]);
    const data = await listEstablishmentActionItems("e1");
    expect(prismaMock.actionItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { establishmentId: "e1", ownerKind: "STRUCTURE" } }));
    expect(data.items.map((i) => i.id)).toEqual(["t1"]);
    expect(data.items[0]?.linkedCriterionCode).toBe("2.2.5");
    expect(data.cabinetPeople).toEqual([]);
    expect(data.canWrite).toBe(true);
  });

  it("tâches du jour : bornées au tenant et à la personne connectée", async () => {
    requireCabinetSession.mockResolvedValue({ userId: "eoda-1", tenantId: "t-1" });
    prismaMock.actionItem.findMany.mockResolvedValue([
      { ...ITEM, ownerUserId: "eoda-1", dueOn: new Date(Date.UTC(2026, 9, 1)), establishmentId: "e1", establishment: { name: "SAD Les Glycines (fictif)" } },
    ]);
    const tasks = await listMyTasksToday(new Date(2026, 9, 12));
    expect(prismaMock.actionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t-1", ownerUserId: "eoda-1", doneAt: null, dueOn: { not: null } } })
    );
    expect(tasks.map((t) => t.establishmentName)).toEqual(["SAD Les Glycines (fictif)"]);
  });
});
