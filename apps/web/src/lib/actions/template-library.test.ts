import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS de setTemplateCriteria (D7) : la garde d'appartenance au tenant est
// ce qui empêche de rattacher des critères à la fiche d'un autre cabinet.

const prismaMock = {
  templateDocument: { findFirst: vi.fn(), create: vi.fn() },
  templateDocumentCriterion: { deleteMany: vi.fn(), createMany: vi.fn() },
  templateCategory: { findFirst: vi.fn() },
  $transaction: vi.fn(),
};

const requireCabinetAdminSession = vi.fn();
const redirectMock = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  TemplateDocumentKind: { GABARIT: "GABARIT", REFERENCE: "REFERENCE" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: redirectMock }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: (...args: []) => requireCabinetAdminSession(...args),
  requireCabinetSession: vi.fn(),
}));

const { setTemplateCriteria, createTemplate } = await import("./template-library");

function templateForm(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ tenantId: "tenant-1" });
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
  prismaMock.templateCategory.findFirst.mockResolvedValue({ id: "cat-1" });
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

describe("createTemplate — plusieurs titres", () => {
  it("crée une seule fiche et redirige vers sa page quand un seul titre est saisi", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue(null);
    prismaMock.templateDocument.create.mockResolvedValue({ id: "tpl-1" });

    await createTemplate(
      null,
      templateForm({ titles: "Projet de service", categoryId: "cat-1", kind: "GABARIT" })
    );

    expect(prismaMock.templateDocument.create).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/cabinet/modeles/tpl-1");
  });

  it("crée une fiche par ligne non vide quand plusieurs titres sont collés", async () => {
    prismaMock.templateDocument.findFirst.mockResolvedValue(null);
    prismaMock.templateDocument.create
      .mockResolvedValueOnce({ id: "tpl-1" })
      .mockResolvedValueOnce({ id: "tpl-2" });

    await createTemplate(
      null,
      templateForm({
        titles: "Livret d'accueil\nRèglement de fonctionnement\n\n",
        categoryId: "cat-1",
        kind: "GABARIT",
      })
    );

    expect(prismaMock.templateDocument.create).toHaveBeenCalledTimes(2);
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/cabinet/modeles");
  });

  it("refuse si un des titres est déjà pris, sans créer les suivants", async () => {
    prismaMock.templateDocument.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "existing" });

    const result = await createTemplate(
      null,
      templateForm({
        titles: "Livret d'accueil\nRèglement de fonctionnement\nProjet de service",
        categoryId: "cat-1",
        kind: "GABARIT",
      })
    );

    expect(result).toEqual({
      error: "Un modèle porte déjà le titre « Règlement de fonctionnement ».",
    });
    expect(prismaMock.templateDocument.create).toHaveBeenCalledTimes(1);
  });
});
