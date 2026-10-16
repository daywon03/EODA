import { beforeEach, describe, expect, it, vi } from "vitest";

// Page « Documents réclamés » (réglage de cabinet, toutes structures) : lecture
// réservée à CABINET_ADMIN, refusée AVANT toute requête ; les types sont rendus
// avec leur état réclamé / produit par EODA, groupés dans l'ordre des catégories.

const prismaMock = { documentType: { findMany: vi.fn() } };
const requireCabinetAdminSession = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/guards", () => ({ requireCabinetAdminSession: () => requireCabinetAdminSession() }));

const { listDocumentTypeScopes } = await import("./document-type-scope");

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ userId: "u-admin", tenantId: "t-1" });
});

describe("listDocumentTypeScopes", () => {
  it("admin : rend chaque type avec sa catégorie et son état", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "t1", label: "Livret d'accueil", category: "LOI_2002_2", requestedFromClient: true },
      { id: "t2", label: "Plan de formation", category: "RH", requestedFromClient: false },
    ]);
    const rows = await listDocumentTypeScopes();
    expect(rows).toEqual([
      { documentTypeId: "t1", label: "Livret d'accueil", category: "LOI_2002_2", requestedFromClient: true },
      { documentTypeId: "t2", label: "Plan de formation", category: "RH", requestedFromClient: false },
    ]);
    expect(prismaMock.documentType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ category: "asc" }, { label: "asc" }] })
    );
  });

  it("non-admin ou non authentifié : refusé avant toute lecture", async () => {
    requireCabinetAdminSession.mockRejectedValue(new Error("FORBIDDEN"));
    await expect(listDocumentTypeScopes()).rejects.toThrow("FORBIDDEN");
    requireCabinetAdminSession.mockRejectedValue(new Error("UNAUTHENTICATED"));
    await expect(listDocumentTypeScopes()).rejects.toThrow("UNAUTHENTICATED");
    expect(prismaMock.documentType.findMany).not.toHaveBeenCalled();
  });

  it("aucun type en base : liste vide", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([]);
    expect(await listDocumentTypeScopes()).toEqual([]);
  });
});
