import { beforeEach, describe, expect, it, vi } from "vitest";

// « Contenus à valider » : la garde est la seule couche (requireContentReviewSession,
// capacité CONTENT_REVIEW) ; rien n'est lu en base avant elle.

const prismaMock = { documentType: { findMany: vi.fn() } };
const guards = { requireContentReviewSession: vi.fn() };

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/guards", () => guards);

const { buildContentReviewExport, getContentReviewCatalog } = await import("./content-review");
const { GET } = await import("@/app/api/export/contenus/route");

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireContentReviewSession.mockResolvedValue({ role: "CABINET_EVALUATOR", tenantId: "t1" });
  prismaMock.documentType.findMany.mockResolvedValue([{ code: "L2002_LIVRET_ACCUEIL", label: "Livret d'accueil" }]);
});

describe("getContentReviewCatalog", () => {
  it("cas nominal : le catalogue, avec les libellés des documents lus en base", async () => {
    const catalog = await getContentReviewCatalog();
    expect(catalog.families).toHaveLength(6);
    expect(JSON.stringify(catalog)).toContain("Livret d'accueil");
  });

  it("non authentifié ou non autorisé : la garde interrompt avant toute lecture", async () => {
    guards.requireContentReviewSession.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(getContentReviewCatalog()).rejects.toThrow("NEXT_REDIRECT");
    await expect(buildContentReviewExport("csv")).rejects.toThrow("NEXT_REDIRECT");
    expect(prismaMock.documentType.findMany).not.toHaveBeenCalled();
  });
});

describe("export — nom de fichier EODA et type", () => {
  it("CSV", async () => {
    const file = await buildContentReviewExport("csv");
    expect(file.fileName).toMatch(/^\d{8}_CONTENUS_EODA_Contenus-a-valider_v01_Interne\.csv$/);
    expect(file.contentType).toBe("text/csv; charset=utf-8");
  });

  it("Word", async () => {
    const file = await buildContentReviewExport("docx");
    expect(file.fileName.endsWith(".docx")).toBe(true);
    expect(Buffer.isBuffer(file.body)).toBe(true);
  });
});

describe("route /api/export/contenus", () => {
  it("refuse un format inconnu (400) sans rien construire", async () => {
    const response = await GET(new Request("https://exemple.test/api/export/contenus?format=pdf"));
    expect(response.status).toBe(400);
    expect(guards.requireContentReviewSession).not.toHaveBeenCalled();
  });

  it("sert le fichier en pièce jointe, sans cache", async () => {
    const response = await GET(new Request("https://exemple.test/api/export/contenus?format=csv"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="\d{8}_CONTENUS_/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
