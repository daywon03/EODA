import { beforeEach, describe, expect, it, vi } from "vitest";

// « Il manque des poubelles » (Sandrine, 09/11/2026) : retirer une ligne créée par le
// cabinet. CABINET_ADMIN seul ; jamais utilisée → supprimée ; utilisée → archivée,
// historique gardé ; loi 2002-2 et référentiel refusés ; journalisé par code.

const prismaMock = {
  documentType: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  document: { count: vi.fn() },
  templateDocument: { count: vi.fn() },
  documentTypeCriterion: { deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
};
const requireCabinetAdminSession = vi.fn();
const recordAuditEvent = vi.fn();
const revalidateTag = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
  unstable_cache: <T,>(fn: T) => fn,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({ requireCabinetAdminSession: () => requireCabinetAdminSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { removeDocumentType } = await import("./document-type-removal");

const CABINET_LINE = { id: "dt-1", code: "EODA_FICHE_CANICULE", category: "QUALITE_RISQUES", archivedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ userId: "u-admin", tenantId: "t-1", session: { user: { role: "CABINET_ADMIN" } } });
  prismaMock.documentType.findUnique.mockResolvedValue(CABINET_LINE);
  prismaMock.document.count.mockResolvedValue(0);
  prismaMock.templateDocument.count.mockResolvedValue(0);
});

describe("garde", () => {
  it("non connecté, consultante, lecture seule : refusé avant toute lecture ni écriture", async () => {
    requireCabinetAdminSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(removeDocumentType("dt-1")).rejects.toThrow("REDIRECT");
    expect(prismaMock.documentType.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.documentType.delete).not.toHaveBeenCalled();
    expect(prismaMock.documentType.update).not.toHaveBeenCalled();
  });

  it("ligne inconnue ou identifiant invalide : notFound", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(removeDocumentType("dt-x")).rejects.toThrow("NOT_FOUND");
    await expect(removeDocumentType(42 as unknown as string)).rejects.toThrow("NOT_FOUND");
  });
});

describe("retrait", () => {
  it("jamais utilisée : supprimée (rattachements compris), journal DOCUMENT_TYPE_DELETED", async () => {
    expect(await removeDocumentType("dt-1")).toEqual({ ok: true, outcome: "DELETED" });
    expect(prismaMock.documentTypeCriterion.deleteMany).toHaveBeenCalledWith({ where: { documentTypeId: "dt-1" } });
    expect(prismaMock.documentType.delete).toHaveBeenCalledWith({ where: { id: "dt-1" } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_TYPE_DELETED", targetId: "dt-1", detail: "EODA_FICHE_CANICULE" })
    );
    expect(revalidateTag).toHaveBeenCalled();
  });

  it("un dépôt arrivé entre le décompte et la suppression : on archive au lieu d'échouer (P2003)", async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce(Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" }))
      .mockImplementationOnce(async (ops: unknown[]) => ops);

    expect(await removeDocumentType("dt-1")).toEqual({ ok: true, outcome: "ARCHIVED" });
    expect(prismaMock.documentType.update).toHaveBeenCalledWith({
      where: { id: "dt-1" },
      data: { archivedAt: expect.any(Date) },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_TYPE_ARCHIVED" }));
  });

  it("une autre erreur de base n'est pas avalée", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "P1001" }));
    await expect(removeDocumentType("dt-1")).rejects.toThrow("boom");
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("utilisée dans une structure : archivée, jamais supprimée ; ses critères ne sont plus attendus", async () => {
    prismaMock.document.count.mockResolvedValue(2);
    expect(await removeDocumentType("dt-1")).toEqual({ ok: true, outcome: "ARCHIVED" });
    expect(prismaMock.documentType.delete).not.toHaveBeenCalled();
    expect(prismaMock.documentType.update).toHaveBeenCalledWith({
      where: { id: "dt-1" },
      data: { archivedAt: expect.any(Date) },
    });
    expect(prismaMock.documentTypeCriterion.deleteMany).toHaveBeenCalledWith({ where: { documentTypeId: "dt-1" } });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_TYPE_ARCHIVED" }));
  });

  it("refuse la loi 2002-2 et le référentiel, sans rien écrire", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue({ ...CABINET_LINE, code: "L2002_DIPC", category: "LOI_2002_2" });
    expect(await removeDocumentType("dt-1")).toEqual({ error: expect.stringContaining("loi 2002-2") });
    prismaMock.documentType.findUnique.mockResolvedValue({ ...CABINET_LINE, code: "P13_FICHE_DECLARATION" });
    expect(await removeDocumentType("dt-1")).toEqual({ error: expect.stringContaining("référentiel") });
    expect(prismaMock.documentType.delete).not.toHaveBeenCalled();
    expect(prismaMock.documentType.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
