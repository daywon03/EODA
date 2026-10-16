import { beforeEach, describe, expect, it, vi } from "vitest";

// Lien gabarit → type de document (N8) : CABINET_ADMIN, gabarit du tenant, jamais un
// document de référence ; chaque changement réindexe (ou retire) l'exemple.

const prismaMock = {
  templateDocument: { findFirst: vi.fn(), update: vi.fn() },
  documentType: { findUnique: vi.fn(), findMany: vi.fn() },
};
const requireCabinetAdminSession = vi.fn();
const reindexValidatedExample = vi.fn();
const recordAuditEvent = vi.fn();
class NotFound extends Error {}

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: () => requireCabinetAdminSession(),
  requireCabinetSession: () => requireCabinetAdminSession(),
}));
vi.mock("@/lib/services/validated-example-indexing", () => ({
  reindexValidatedExample: (...args: unknown[]) => reindexValidatedExample(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args) }));

const { setTemplateDocumentType } = await import("./template-example");
const { isValidatedExampleCandidate } = await import("@/lib/services/knowledge-indexing-service");

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ tenantId: "tenant-a", userId: "admin", role: "CABINET_ADMIN" });
  prismaMock.templateDocument.findFirst.mockResolvedValue({ id: "tpl-1", kind: "GABARIT" });
  prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-1", code: "L2002_REGLEMENT" });
  prismaMock.templateDocument.update.mockResolvedValue({});
});

describe("setTemplateDocumentType", () => {
  it("rattache un gabarit du tenant, réindexe l'exemple et journalise", async () => {
    expect(await setTemplateDocumentType("tpl-1", "dt-1")).toBeNull();
    expect(prismaMock.templateDocument.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "tpl-1", tenantId: "tenant-a" } }));
    expect(prismaMock.templateDocument.update).toHaveBeenCalledWith({ where: { id: "tpl-1" }, data: { documentTypeId: "dt-1" } });
    expect(reindexValidatedExample).toHaveBeenCalledWith("tenant-a", "tpl-1");
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "TEMPLATE_DOCUMENT_TYPE_LINKED", detail: "L2002_REGLEMENT" }));
  });

  it("détache (aucun type) : l'exemple est retiré par la réindexation", async () => {
    expect(await setTemplateDocumentType("tpl-1", null)).toBeNull();
    expect(prismaMock.templateDocument.update).toHaveBeenCalledWith({ where: { id: "tpl-1" }, data: { documentTypeId: null } });
    expect(reindexValidatedExample).toHaveBeenCalled();
  });

  it("refuse un document de référence et un type inconnu", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue({ id: "tpl-1", kind: "REFERENCE" });
    expect(await setTemplateDocumentType("tpl-1", "dt-1")).toMatchObject({ error: expect.stringMatching(/référence/) });
    prismaMock.templateDocument.findFirst.mockResolvedValue({ id: "tpl-1", kind: "GABARIT" });
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    expect(await setTemplateDocumentType("tpl-1", "dt-x")).toMatchObject({ error: expect.any(String) });
    expect(prismaMock.templateDocument.update).not.toHaveBeenCalled();
  });

  it("gabarit d'un autre tenant : introuvable ; non-admin : la garde refuse", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue(null);
    await expect(setTemplateDocumentType("tpl-autre", "dt-1")).rejects.toThrow("NEXT_NOT_FOUND");
    requireCabinetAdminSession.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(setTemplateDocumentType("tpl-1", "dt-1")).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("isValidatedExampleCandidate", () => {
  it("seulement un gabarit FINALE rattaché à un type", () => {
    expect(isValidatedExampleCandidate({ kind: "GABARIT", stage: "FINALE", documentTypeId: "dt" })).toBe(true);
    expect(isValidatedExampleCandidate({ kind: "GABARIT", stage: "VIERGE", documentTypeId: "dt" })).toBe(false);
    expect(isValidatedExampleCandidate({ kind: "GABARIT", stage: "FINALE", documentTypeId: null })).toBe(false);
    expect(isValidatedExampleCandidate({ kind: "REFERENCE", stage: null, documentTypeId: "dt" })).toBe(false);
  });
});
