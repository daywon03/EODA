import { beforeEach, describe, expect, it, vi } from "vitest";

// Nouvelle ligne dans « Documents » (28/10/2026) : CABINET_ADMIN seul, une ligne
// créée UNE fois pour toutes les structures, doublon refusé, loi 2002-2 fermée,
// journalisée, et annoncée aux seules structures accompagnées dont l'offre suit la
// catégorie — jamais à une fiche d'un autre cabinet.

class KnownError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const prismaMock = {
  documentType: { findMany: vi.fn(), create: vi.fn() },
  establishment: { findFirst: vi.fn(), findMany: vi.fn() },
};
const requireCabinetAdminSession = vi.fn();
const recordAuditEvent = vi.fn();
const notifyNewDocumentType = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  Prisma: { PrismaClientKnownRequestError: KnownError },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({ requireCabinetAdminSession: () => requireCabinetAdminSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/email/notifications", () => ({
  notifyNewDocumentType: (...args: unknown[]) => notifyNewDocumentType(...args),
}));

const { createDocumentType } = await import("./document-type-creation");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

const valid = { label: "  Plan de   continuité d'activité ", category: "QUALITE_RISQUES", provider: "STRUCTURE", announce: "on" };

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({
    userId: "u-admin",
    tenantId: "t-1",
    session: { user: { role: "CABINET_ADMIN" } },
  });
  prismaMock.documentType.findMany.mockResolvedValue([{ label: "Registre des plaintes", code: "Q_PLAINTES" }]);
  prismaMock.documentType.create.mockResolvedValue({ id: "dt-new" });
  prismaMock.establishment.findMany.mockResolvedValue([]);
  notifyNewDocumentType.mockResolvedValue({ sent: 1, total: 1 });
});

describe("garde", () => {
  it("non-admin : refusé avant toute lecture ni écriture", async () => {
    requireCabinetAdminSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(createDocumentType(form(valid))).rejects.toThrow("REDIRECT");
    expect(prismaMock.documentType.findMany).not.toHaveBeenCalled();
    expect(prismaMock.documentType.create).not.toHaveBeenCalled();
  });

  it("une fiche d'un autre cabinet : notFound, rien n'est créé", async () => {
    prismaMock.establishment.findFirst.mockResolvedValue(null);
    await expect(createDocumentType(form({ ...valid, establishmentId: "etab-autre" }))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.establishment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "etab-autre", tenantId: "t-1" } })
    );
    expect(prismaMock.documentType.create).not.toHaveBeenCalled();
  });
});

describe("règles", () => {
  it("refuse un doublon, la loi 2002-2 et un nom vide sans rien écrire", async () => {
    expect(await createDocumentType(form({ ...valid, label: "registre des plaintes" }))).toEqual({
      error: "Ce document existe déjà dans la liste : « Registre des plaintes ».",
    });
    expect(await createDocumentType(form({ ...valid, category: "LOI_2002_2" }))).toEqual({
      error: expect.stringMatching(/loi 2002-2/),
    });
    expect(await createDocumentType(form({ ...valid, label: "" }))).toEqual({ error: expect.stringMatching(/obligatoire/) });
    expect(prismaMock.documentType.create).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("une création concurrente (code unique) est dite, pas levée", async () => {
    prismaMock.documentType.create.mockRejectedValue(new KnownError("P2002"));
    expect(await createDocumentType(form(valid))).toEqual({ error: expect.stringMatching(/vient d'être ajouté/) });
  });
});

describe("création", () => {
  it("crée UN type global (aucune structure), libellé nettoyé, code EODA_, et journalise", async () => {
    const result = await createDocumentType(form(valid));

    expect(prismaMock.documentType.create).toHaveBeenCalledWith({
      data: {
        code: "EODA_PLAN_DE_CONTINUITE_D_ACTIVITE",
        category: "QUALITE_RISQUES",
        label: "Plan de continuité d'activité",
        requestedFromClient: true,
      },
      select: { id: true },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_TYPE_CREATED", actorUserId: "u-admin", targetId: "dt-new" })
    );
    expect(result).toEqual(expect.objectContaining({ ok: true, documentTypeId: "dt-new", visibleOnStructure: null }));
  });

  it("« EODA le prépare » : produit par EODA", async () => {
    await createDocumentType(form({ ...valid, provider: "EODA" }));
    expect(prismaMock.documentType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requestedFromClient: false }) })
    );
  });

  it("depuis une fiche : dit si la ligne y apparaît (offre qui suit la catégorie)", async () => {
    prismaMock.establishment.findFirst.mockResolvedValue({ id: "e1", mission: { formule: "ESSENTIEL", gratuit: false } });
    const result = await createDocumentType(form({ ...valid, category: "RH", establishmentId: "e1" }));
    expect(result).toEqual(expect.objectContaining({ ok: true, visibleOnStructure: false }));
  });
});

describe("annonce", () => {
  const mission = (overrides: Record<string, unknown> = {}) => ({
    formule: "EXCELLENCE",
    gratuit: false,
    closedAt: null,
    clientAccessRevokedAt: null,
    ...overrides,
  });

  it("prévient les seules structures accompagnées du cabinet dont l'offre suit la catégorie", async () => {
    prismaMock.establishment.findMany.mockResolvedValue([
      { id: "e-ok", name: "Structure A", mission: mission() },
      { id: "e-close", name: "Structure B", mission: mission({ closedAt: new Date("2026-01-01") }) },
      { id: "e-revoquee", name: "Structure C", mission: mission({ clientAccessRevokedAt: new Date("2026-01-01") }) },
      { id: "e-sans-mission", name: "Structure D", mission: null },
    ]);

    const result = await createDocumentType(form(valid));

    expect(prismaMock.establishment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "t-1" } }));
    expect(notifyNewDocumentType).toHaveBeenCalledTimes(1);
    expect(notifyNewDocumentType).toHaveBeenCalledWith({
      establishmentId: "e-ok",
      establishmentName: "Structure A",
      documentLabel: "Plan de continuité d'activité",
      requestedFromClient: true,
    });
    expect(result).toEqual(expect.objectContaining({ announced: { structures: 1, sent: 1, recipients: 1 } }));
  });

  it("sans la case cochée, personne n'est prévenu", async () => {
    const result = await createDocumentType(
      form({ label: valid.label, category: valid.category, provider: valid.provider })
    );
    expect(prismaMock.establishment.findMany).not.toHaveBeenCalled();
    expect(notifyNewDocumentType).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ announced: null }));
  });
});
