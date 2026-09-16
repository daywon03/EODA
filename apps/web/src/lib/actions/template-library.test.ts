import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS de setTemplateCriteria (D7) : la garde d'appartenance au tenant est
// ce qui empêche de rattacher des critères à la fiche d'un autre cabinet.

const prismaMock = {
  templateDocument: { findFirst: vi.fn() },
  templateDocumentCriterion: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
};

const requireCabinetAdminSession = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: (...args: []) => requireCabinetAdminSession(...args),
  requireCabinetSession: vi.fn(),
}));

const { setTemplateCriteria } = await import("./template-library");

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ tenantId: "tenant-1" });
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
});

describe("setTemplateCriteria", () => {
  it("refuse une fiche qui n'appartient pas au tenant", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue(null);

    const result = await setTemplateCriteria("tpl-1", ["crit-1"]);

    expect(result).toEqual({ error: "Ce modèle n'existe pas." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("remplace la liste des critères rattachés en une transaction", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue({ id: "tpl-1" });

    const result = await setTemplateCriteria("tpl-1", ["crit-1", "crit-2"]);

    expect(result).toBeNull();
    expect(prismaMock.templateDocumentCriterion.deleteMany).toHaveBeenCalledWith({
      where: { templateDocumentId: "tpl-1" },
    });
    expect(prismaMock.templateDocumentCriterion.createMany).toHaveBeenCalledWith({
      data: [
        { templateDocumentId: "tpl-1", criterionId: "crit-1" },
        { templateDocumentId: "tpl-1", criterionId: "crit-2" },
      ],
    });
  });

  it("accepte une liste vide (retirer tous les critères rattachés)", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue({ id: "tpl-1" });

    const result = await setTemplateCriteria("tpl-1", []);

    expect(result).toBeNull();
    expect(prismaMock.templateDocumentCriterion.createMany).toHaveBeenCalledWith({ data: [] });
  });
});
