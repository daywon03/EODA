import { beforeEach, describe, expect, it, vi } from "vitest";

// File « À relire » côté cabinet : le compteur et la liste sont filtrés par le
// tenant DE LA GARDE, sans condition (fail-closed), et ne s'exécutent pas sans elle.

class RedirectError extends Error {}

const prismaMock = { documentVersion: { count: vi.fn(), findMany: vi.fn() } };
const requireCabinetSession = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  Prisma: { AnyNull: "AnyNull" },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: () => requireCabinetSession(),
}));

const { countDocumentsAwaitingReview, listDocumentsAwaitingReview } = await import("./review-queue");

const EXPECTED_WHERE = {
  analysisResultJson: { not: "AnyNull" },
  analysisReviewedAt: null,
  currentForDocument: { isNot: null },
  document: { establishment: { tenantId: "tenant-1" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetSession.mockResolvedValue({ userId: "u1", tenantId: "tenant-1", role: "CABINET_EVALUATOR" });
  prismaMock.documentVersion.count.mockResolvedValue(0);
  prismaMock.documentVersion.findMany.mockResolvedValue([]);
});

describe("countDocumentsAwaitingReview", () => {
  it("compte les analyses non relues des versions courantes du tenant de l'appelant", async () => {
    prismaMock.documentVersion.count.mockResolvedValue(4);
    await expect(countDocumentsAwaitingReview()).resolves.toBe(4);
    expect(prismaMock.documentVersion.count).toHaveBeenCalledWith({ where: EXPECTED_WHERE });
  });

  it("non authentifié ou client : la garde refuse, rien n'est lu", async () => {
    requireCabinetSession.mockRejectedValue(new RedirectError());
    await expect(countDocumentsAwaitingReview()).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.documentVersion.count).not.toHaveBeenCalled();
  });
});

describe("listDocumentsAwaitingReview", () => {
  it("liste la file du tenant, convertie et du plus ancien au plus récent", async () => {
    prismaMock.documentVersion.findMany.mockResolvedValue([
      {
        id: "v2",
        versionNumber: 1,
        uploadedAt: new Date("2026-10-02"),
        originalFilename: "projet.docx",
        document: { documentType: null, establishment: { id: "e2", name: "SAD Le Moulin (fictif)" } },
      },
      {
        id: "v1",
        versionNumber: 3,
        uploadedAt: new Date("2026-09-20"),
        originalFilename: "livret.pdf",
        document: {
          documentType: { label: "Livret d'accueil" },
          establishment: { id: "e1", name: "SAD Les Glycines (fictif)" },
        },
      },
    ]);
    prismaMock.documentVersion.count.mockResolvedValue(2);

    const { items, totalCount } = await listDocumentsAwaitingReview();

    expect(totalCount).toBe(2);
    expect(items.map((i) => [i.versionId, i.documentLabel, i.href])).toEqual([
      ["v1", "Livret d'accueil", "/dashboard/cabinet/etablissements/e1"],
      ["v2", "projet.docx", "/dashboard/cabinet/etablissements/e2"],
    ]);
    expect(prismaMock.documentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: EXPECTED_WHERE, orderBy: { uploadedAt: "asc" } })
    );
  });

  it("file vide : liste vide, pas d'erreur", async () => {
    await expect(listDocumentsAwaitingReview()).resolves.toEqual({ items: [], totalCount: 0 });
  });

  it("sans garde valide, aucune lecture", async () => {
    requireCabinetSession.mockRejectedValue(new RedirectError());
    await expect(listDocumentsAwaitingReview()).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.documentVersion.findMany).not.toHaveBeenCalled();
  });
});
