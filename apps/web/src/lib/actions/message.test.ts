import { beforeEach, describe, expect, it, vi } from "vitest";

// Le fil d'échange (audit du 28/10/2026) : la garde avant toute lecture, aucune écriture
// quand elle refuse, le débit par personne, la trace sans le texte, un seul e-mail par
// prise de parole, et le fil borné.

const prismaMock = {
  missionMessage: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  establishment: { findUnique: vi.fn() },
};
const requireEstablishmentInTenant = vi.fn();
const requireClientEstablishment = vi.fn();
const consumeThrottledAttempt = vi.fn();
const recordAuditEvent = vi.fn();
const notifyNewMessage = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: vi.fn(),
  structureScopeWhere: vi.fn(),
  requireEstablishmentInTenant: (...args: unknown[]) => requireEstablishmentInTenant(...args),
  requireClientEstablishment: (...args: unknown[]) => requireClientEstablishment(...args),
}));
vi.mock("@/lib/security/attempt-throttle", () => ({ consumeThrottledAttempt: (o: unknown) => consumeThrottledAttempt(o) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));
vi.mock("@/lib/email/notifications", () => ({ notifyNewMessage: (i: unknown) => notifyNewMessage(i) }));

const { getCabinetThread, postCabinetMessage, postClientMessage } = await import("./message");

const form = (body: string) => {
  const data = new FormData();
  data.set("body", body);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({ tenantId: "t1", userId: "u-cabinet" });
  requireClientEstablishment.mockResolvedValue({ establishment: { id: "e1", name: "Structure" }, missionAccess: "ACTIVE", userId: "u-client" });
  prismaMock.establishment.findUnique.mockResolvedValue({ name: "Structure", tenantId: "t1" });
  prismaMock.missionMessage.findFirst.mockResolvedValue(null);
  prismaMock.missionMessage.create.mockResolvedValue({ id: "m1" });
  prismaMock.missionMessage.findMany.mockResolvedValue([]);
  consumeThrottledAttempt.mockResolvedValue(true);
});

describe("côté cabinet", () => {
  it("garde de LECTURE pour lire, d'ÉCRITURE pour écrire, avant toute requête", async () => {
    requireEstablishmentInTenant.mockRejectedValueOnce(new Error("NOT_FOUND"));
    await expect(getCabinetThread("e-autre")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.missionMessage.findMany).not.toHaveBeenCalled();

    await postCabinetMessage("e1", null, form("Bonjour"));
    expect(requireEstablishmentInTenant).toHaveBeenLastCalledWith("e1", "WRITE");
  });

  it("hors périmètre : rien n'est écrit, rien n'est envoyé", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(postCabinetMessage("e-autre", null, form("Bonjour"))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.missionMessage.create).not.toHaveBeenCalled();
    expect(notifyNewMessage).not.toHaveBeenCalled();
  });

  it("le fil est borné à ses derniers messages, remis dans l'ordre de lecture", async () => {
    prismaMock.missionMessage.findMany.mockResolvedValue([
      { id: "b", authorSide: "CLIENT", body: "2", createdAt: new Date("2026-10-28T10:00:00Z"), author: { name: null } },
      { id: "a", authorSide: "CABINET", body: "1", createdAt: new Date("2026-10-28T09:00:00Z"), author: { name: "S" } },
    ]);
    const thread = await getCabinetThread("e1");
    expect(thread.map((m) => m.id)).toEqual(["a", "b"]);
    expect(prismaMock.missionMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 300, where: { establishmentId: "e1" } }));
  });
});

describe("côté structure", () => {
  it("aucun identifiant reçu ; un accès révoqué n'écrit rien", async () => {
    requireClientEstablishment.mockResolvedValue({ establishment: { id: "e1", name: "Structure" }, missionAccess: "REVOKED", userId: "u-client" });
    expect(await postClientMessage(null, form("Bonjour"))).toEqual({ error: "Votre accès ne permet plus d'envoyer de message." });
    expect(requireClientEstablishment).toHaveBeenCalledWith({ module: "MESSAGES", mode: "WRITE" });
    expect(prismaMock.missionMessage.create).not.toHaveBeenCalled();
  });

  it("cas nominal : écrit, journalise SANS le texte, prévient le cabinet", async () => {
    expect(await postClientMessage(null, form("Mme X ne va pas bien"))).toEqual({ ok: true });
    expect(prismaMock.missionMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: "t1", establishmentId: "e1", authorSide: "CLIENT" }) }));
    expect(recordAuditEvent).toHaveBeenCalledWith({ action: "MISSION_MESSAGE_POSTED", actorUserId: "u-client", establishmentId: "e1", targetId: "m1", detail: "CLIENT" });
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("Mme X");
    expect(notifyNewMessage).toHaveBeenCalledWith({ tenantId: "t1", establishmentId: "e1", establishmentName: "Structure", authorSide: "CLIENT" });
  });
});

describe("abus", () => {
  it("au-delà du débit : refusé, rien n'est écrit ni envoyé ; la clé est la PERSONNE", async () => {
    consumeThrottledAttempt.mockResolvedValue(false);
    expect(await postClientMessage(null, form("encore"))).toEqual({ error: expect.stringContaining("beaucoup de messages") });
    expect(consumeThrottledAttempt).toHaveBeenCalledWith(expect.objectContaining({ key: "message:u-client", auditAction: "MISSION_MESSAGE_RATE_LIMITED" }));
    expect(prismaMock.missionMessage.create).not.toHaveBeenCalled();
    expect(notifyNewMessage).not.toHaveBeenCalled();
  });

  it("un message vide n'entame pas le débit", async () => {
    expect(await postCabinetMessage("e1", null, form("   "))).toEqual({ error: "Le message est vide." });
    expect(consumeThrottledAttempt).not.toHaveBeenCalled();
  });

  it("une suite de messages du même côté ne refait pas d'e-mail ; une réponse, si", async () => {
    prismaMock.missionMessage.findFirst.mockResolvedValue({ authorSide: "CABINET", createdAt: new Date() });
    await postCabinetMessage("e1", null, form("suite"));
    expect(notifyNewMessage).not.toHaveBeenCalled();
    await postClientMessage(null, form("réponse"));
    expect(notifyNewMessage).toHaveBeenCalledTimes(1);
  });
});
