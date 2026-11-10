import { beforeEach, describe, expect, it, vi } from "vitest";

// « Demander à la structure » depuis un élément manquant de l'analyse (09/11/2026) :
// cabinet seul, garde DOCUMENTS_WRITE sur la structure ; une tâche confiée à la
// structure (source DOCUMENT) ; la structure est prévenue par e-mail avec l'INTITULÉ
// du type, jamais le texte de la demande ; le journal ne porte pas le titre.

const prismaMock = {
  establishment: { findUnique: vi.fn() },
  documentType: { findUnique: vi.fn() },
  document: { findUnique: vi.fn() },
  actionItem: { create: vi.fn() },
};
const requireEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();
const notifyInformationRequested = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (id: string, need: unknown) => requireEstablishmentAccess(id, need),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/email/notifications", () => ({
  notifyInformationRequested: (...args: unknown[]) => notifyInformationRequested(...args),
}));

const { requestInformationFromStructure } = await import("./information-request");

const CABINET = { session: { user: { role: "CABINET_EVALUATOR" } }, userId: "eoda-1", establishmentId: "e1", isClient: false, missionAccess: "ACTIVE" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const VALID = { establishmentId: "e1", documentTypeId: "dt-livret", title: "Livret d'accueil : compléter « Les horaires »" };

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue(CABINET);
  prismaMock.establishment.findUnique.mockResolvedValue({ tenantId: "t-1", name: "Structure Test" });
  prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-livret", label: "Livret d'accueil", archivedAt: null });
  prismaMock.document.findUnique.mockResolvedValue({ id: "doc-1" });
  prismaMock.actionItem.create.mockResolvedValue({ id: "a-1", source: "DOCUMENT", ownerKind: "STRUCTURE" });
  notifyInformationRequested.mockResolvedValue({ sent: 2, total: 2 });
});

describe("garde", () => {
  it("passe par requireEstablishmentAccess en DOCUMENTS_WRITE", async () => {
    await requestInformationFromStructure(form(VALID));
    expect(requireEstablishmentAccess).toHaveBeenCalledWith("e1", { module: "DOCUMENTS", mode: "WRITE" });
  });

  it("non connecté, lecture seule, autre cabinet : la garde refuse, rien n'est écrit", async () => {
    requireEstablishmentAccess.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(requestInformationFromStructure(form(VALID))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
    expect(notifyInformationRequested).not.toHaveBeenCalled();
  });

  it("un compte de la STRUCTURE ne se demande rien à lui-même : notFound", async () => {
    requireEstablishmentAccess.mockResolvedValue({ ...CABINET, isClient: true });
    await expect(requestInformationFromStructure(form(VALID))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("structure manquante : refus avant toute garde", async () => {
    expect(await requestInformationFromStructure(form({ ...VALID, establishmentId: "" }))).toEqual({ error: "Structure manquante." });
    expect(requireEstablishmentAccess).not.toHaveBeenCalled();
  });
});

describe("demande", () => {
  it("crée une tâche confiée à la structure, source DOCUMENT, liée au document, et prévient la structure", async () => {
    expect(await requestInformationFromStructure(form(VALID))).toEqual({ ok: true, notified: 2 });
    expect(prismaMock.actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "t-1",
          establishmentId: "e1",
          title: VALID.title,
          ownerKind: "STRUCTURE",
          ownerUserId: null,
          source: "DOCUMENT",
          linkedDocumentId: "doc-1",
          createdByUserId: "eoda-1",
        }),
      })
    );
    expect(notifyInformationRequested).toHaveBeenCalledWith({
      establishmentId: "e1",
      establishmentName: "Structure Test",
      documentLabel: "Livret d'accueil",
    });
    const audit = recordAuditEvent.mock.calls[0]?.[0] as { action: string; detail: string };
    expect(audit.action).toBe("ACTION_ITEM_CREATED");
    expect(audit.detail).not.toContain("horaires");
  });

  it("refuse un texte vide ou trop long, sans rien écrire", async () => {
    expect(await requestInformationFromStructure(form({ ...VALID, title: "   " }))).toEqual({ error: expect.any(String) });
    expect(await requestInformationFromStructure(form({ ...VALID, title: "x".repeat(401) }))).toEqual({ error: expect.any(String) });
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("type inconnu ou archivé : notFound", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(requestInformationFromStructure(form(VALID))).rejects.toThrow("NOT_FOUND");
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-livret", label: "Livret", archivedAt: new Date() });
    await expect(requestInformationFromStructure(form(VALID))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("accompagnement clôturé : refus, la structure ne pourrait pas y répondre", async () => {
    requireEstablishmentAccess.mockResolvedValue({ ...CABINET, missionAccess: "LIBRARY" });
    expect(await requestInformationFromStructure(form(VALID))).toEqual({ error: expect.stringContaining("clôturé") });
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
  });

  it("l'e-mail ne part pas : la tâche reste créée, l'écran le dit (notified: 0)", async () => {
    notifyInformationRequested.mockResolvedValue({ sent: 0, total: 0 });
    expect(await requestInformationFromStructure(form(VALID))).toEqual({ ok: true, notified: 0 });
    expect(prismaMock.actionItem.create).toHaveBeenCalled();
  });
});
