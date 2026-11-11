import { beforeEach, describe, expect, it, vi } from "vitest";

// Retour de Sandrine (10/11/2026) : retirer une ligne de « Documents » pour CE client
// seulement. Administration du cabinet, structure de SON cabinet (sinon notFound) ;
// loi 2002-2 et ligne avec dépôt refusées ; réversible ; journal par code.

const prismaMock = {
  documentType: { findUnique: vi.fn() },
  document: { findUnique: vi.fn() },
  establishmentDocumentTypeExclusion: { upsert: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
};
const requireAdminEstablishmentInTenant = vi.fn();
const recordAuditEvent = vi.fn();
const revalidateDocumentViews = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireAdminEstablishmentInTenant: (id: string) => requireAdminEstablishmentInTenant(id),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("./document-views-revalidation", () => ({
  revalidateDocumentViews: (id: string) => revalidateDocumentViews(id),
}));

const { hideDocumentTypeForEstablishment, restoreDocumentTypeForEstablishment, listHiddenDocumentTypes } =
  await import("./document-type-exclusion");

const LINE = { id: "dt-1", code: "EODA_CHARTE_INFO", label: "Charte informatique", category: "QUALITE_RISQUES", archivedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminEstablishmentInTenant.mockResolvedValue({
    userId: "u-admin",
    tenantId: "t-1",
    session: { user: { role: "CABINET_ADMIN" } },
    establishmentId: "etab-1",
  });
  prismaMock.documentType.findUnique.mockResolvedValue(LINE);
  prismaMock.document.findUnique.mockResolvedValue(null);
});

describe("hideDocumentTypeForEstablishment", () => {
  it("masque la ligne pour cette structure, journalise le code, rafraîchit ses vues", async () => {
    expect(await hideDocumentTypeForEstablishment("etab-1", "dt-1")).toBeNull();
    expect(prismaMock.establishmentDocumentTypeExclusion.upsert).toHaveBeenCalledWith({
      where: { establishmentId_documentTypeId: { establishmentId: "etab-1", documentTypeId: "dt-1" } },
      create: { establishmentId: "etab-1", documentTypeId: "dt-1" },
      update: {},
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DOCUMENT_TYPE_HIDDEN_FOR_ESTABLISHMENT",
        establishmentId: "etab-1",
        targetId: "dt-1",
        detail: "EODA_CHARTE_INFO",
      })
    );
    expect(revalidateDocumentViews).toHaveBeenCalledWith("etab-1");
  });

  it("non-administratrice ou structure hors cabinet : refusé avant toute lecture", async () => {
    requireAdminEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(hideDocumentTypeForEstablishment("autre", "dt-1")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.documentType.findUnique).not.toHaveBeenCalled();
  });

  it("ligne inconnue ou archivée : notFound", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(hideDocumentTypeForEstablishment("etab-1", "x")).rejects.toThrow("NOT_FOUND");
    prismaMock.documentType.findUnique.mockResolvedValue({ ...LINE, archivedAt: new Date() });
    await expect(hideDocumentTypeForEstablishment("etab-1", "dt-1")).rejects.toThrow("NOT_FOUND");
  });

  it("refuse la loi 2002-2, sans rien écrire", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue({ ...LINE, category: "LOI_2002_2" });
    expect(await hideDocumentTypeForEstablishment("etab-1", "dt-1")).toMatchObject({ error: expect.stringContaining("loi 2002-2") });
    expect(prismaMock.establishmentDocumentTypeExclusion.upsert).not.toHaveBeenCalled();
  });

  it("refuse une ligne qui porte un dépôt, sans rien écrire", async () => {
    prismaMock.document.findUnique.mockResolvedValue({ currentVersionId: "v-1" });
    expect(await hideDocumentTypeForEstablishment("etab-1", "dt-1")).toMatchObject({ error: expect.stringContaining("déposée") });
    expect(prismaMock.establishmentDocumentTypeExclusion.upsert).not.toHaveBeenCalled();
  });
});

describe("restoreDocumentTypeForEstablishment", () => {
  it("rétablit la ligne, journalise le code", async () => {
    prismaMock.establishmentDocumentTypeExclusion.deleteMany.mockResolvedValue({ count: 1 });
    expect(await restoreDocumentTypeForEstablishment("etab-1", "dt-1")).toBeNull();
    expect(prismaMock.establishmentDocumentTypeExclusion.deleteMany).toHaveBeenCalledWith({
      where: { establishmentId: "etab-1", documentTypeId: "dt-1" },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_TYPE_RESTORED_FOR_ESTABLISHMENT", detail: "EODA_CHARTE_INFO" })
    );
  });

  it("rien à rétablir : aucun journal", async () => {
    prismaMock.establishmentDocumentTypeExclusion.deleteMany.mockResolvedValue({ count: 0 });
    expect(await restoreDocumentTypeForEstablishment("etab-1", "dt-1")).toBeNull();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("listHiddenDocumentTypes", () => {
  it("rend les lignes masquées de CETTE structure, par intitulé", async () => {
    prismaMock.establishmentDocumentTypeExclusion.findMany.mockResolvedValue([
      { hiddenAt: new Date("2026-11-10"), documentType: { id: "dt-2", label: "Registre", archivedAt: null } },
      { hiddenAt: new Date("2026-11-10"), documentType: { id: "dt-1", label: "Charte informatique", archivedAt: null } },
      { hiddenAt: new Date("2026-11-10"), documentType: { id: "dt-3", label: "Archivée", archivedAt: new Date() } },
    ]);
    expect((await listHiddenDocumentTypes("etab-1")).map((t) => t.documentTypeId)).toEqual(["dt-1", "dt-2"]);
    expect(prismaMock.establishmentDocumentTypeExclusion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { establishmentId: "etab-1" } })
    );
  });
});
