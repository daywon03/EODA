import { beforeEach, describe, expect, it, vi } from "vitest";

// Fil de commentaires d'un document (10/11/2026). Cabinet seulement, structure de son
// cabinet ; append-only ; journal sans le texte ; un commentaire d'une autre
// structure ne se bascule pas (notFound).

const prismaMock = {
  documentType: { findUnique: vi.fn() },
  document: { upsert: vi.fn() },
  documentComment: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};
const requireEstablishmentInTenant = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (id: string, mode: string) => requireEstablishmentInTenant(id, mode),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { addDocumentComment, listDocumentComments, setDocumentCommentAiUse } = await import("./document-comment");

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({
    userId: "u-eval",
    tenantId: "t-1",
    session: { user: { role: "CABINET_EVALUATOR" } },
    establishmentId: "etab-1",
  });
  prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-pca", code: "QUALITE_PCA" });
  prismaMock.document.upsert.mockResolvedValue({ id: "doc-1" });
});

describe("addDocumentComment", () => {
  it("ajoute un commentaire daté au fil, sans écraser, et journalise le code seulement", async () => {
    expect(await addDocumentComment("etab-1", "dt-pca", " DPO : Julien Chevalier ")).toBeNull();
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "WRITE");
    expect(prismaMock.documentComment.create).toHaveBeenCalledWith({
      data: { documentId: "doc-1", authorUserId: "u-eval", text: "DPO : Julien Chevalier", aiEnabled: true },
    });
    const audit = recordAuditEvent.mock.calls[0]?.[0] as { detail: string; action: string };
    expect(audit.action).toBe("DOCUMENT_COMMENT_ADDED");
    expect(audit.detail).toBe("QUALITE_PCA");
    expect(JSON.stringify(audit)).not.toContain("Julien");
  });

  it("refuse un commentaire vide, sans rien écrire", async () => {
    expect(await addDocumentComment("etab-1", "dt-pca", "   ")).toMatchObject({ error: expect.stringContaining("vide") });
    expect(prismaMock.documentComment.create).not.toHaveBeenCalled();
  });

  it("structure d'un autre cabinet, compte client ou non connecté : refusé avant toute écriture", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(addDocumentComment("autre", "dt-pca", "x")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
  });

  it("type de document inconnu : notFound", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(addDocumentComment("etab-1", "inconnu", "x")).rejects.toThrow("NOT_FOUND");
  });
});

describe("listDocumentComments", () => {
  it("lit en lecture le fil du document de CETTE structure, du plus récent au plus ancien", async () => {
    prismaMock.documentComment.findMany.mockResolvedValue([
      { id: "c2", text: "b", aiEnabled: true, createdAt: new Date(2026, 10, 10), author: { name: "Sandrine" } },
      { id: "c1", text: "a", aiEnabled: false, createdAt: new Date(2026, 10, 1), author: null },
    ]);
    const list = await listDocumentComments("etab-1", "dt-pca");
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "READ");
    expect(prismaMock.documentComment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { document: { establishmentId: "etab-1", documentTypeId: "dt-pca" } },
        orderBy: { createdAt: "desc" },
      })
    );
    expect(list.map((c) => [c.id, c.authorName])).toEqual([
      ["c2", "Sandrine"],
      ["c1", null],
    ]);
  });
});

describe("setDocumentCommentAiUse — par commentaire", () => {
  it("bascule un commentaire de CETTE structure et journalise oui / non, sans le texte", async () => {
    prismaMock.documentComment.findFirst.mockResolvedValue({
      id: "c1",
      aiEnabled: true,
      document: { documentTypeId: "dt-pca", documentType: { code: "QUALITE_PCA" } },
    });
    expect(await setDocumentCommentAiUse("etab-1", "c1", false)).toBeNull();
    expect(prismaMock.documentComment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1", document: { establishmentId: "etab-1" } } })
    );
    expect(prismaMock.documentComment.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { aiEnabled: false } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_COMMENT_AI_TOGGLED", detail: "QUALITE_PCA · non" })
    );
  });

  it("commentaire d'une autre structure : notFound, rien n'est écrit", async () => {
    prismaMock.documentComment.findFirst.mockResolvedValue(null);
    await expect(setDocumentCommentAiUse("etab-1", "c-autre", false)).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.documentComment.update).not.toHaveBeenCalled();
  });
});
