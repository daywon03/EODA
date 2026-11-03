import { beforeEach, describe, expect, it, vi } from "vitest";

// Dossiers de la liste « Documents » et import d'un tableur (call du 29/10/2026) :
// CABINET_ADMIN seul pour écrire, dossier inconnu → notFound, doublon nommé, journal
// sans donnée de personne, et l'import RECALCULÉ côté serveur — une ligne en double
// ou au critère inconnu n'est jamais créée, quoi que le navigateur envoie.

const prismaMock = {
  documentFolder: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  documentType: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  documentTypeCriterion: { createMany: vi.fn() },
  criterion: { findMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock)),
};
const requireCabinetAdminSession = vi.fn();
const requireCabinetSession = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T,>(fn: T) => fn }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: () => requireCabinetAdminSession(),
  requireCabinetSession: (need: string) => requireCabinetSession(need),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args) }));

const {
  createDocumentFolder,
  importDocumentTypes,
  listDocumentFolders,
  previewDocumentTypeImport,
  renameDocumentFolder,
  setDocumentTypeFolder,
} = await import("./document-folder");

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ userId: "u-admin", session: { user: { role: "CABINET_ADMIN" } } });
  requireCabinetSession.mockResolvedValue({ userId: "u-1" });
  prismaMock.documentFolder.findMany.mockResolvedValue([{ label: "Stratégie", position: 3 }]);
  prismaMock.documentFolder.create.mockResolvedValue({ id: "f-new" });
  prismaMock.documentType.findMany.mockResolvedValue([{ label: "Note de service", code: "FONCT_NOTE_SERVICE" }]);
  prismaMock.criterion.findMany.mockResolvedValue([
    { id: "c-3142", code: "3.14.2" },
    { id: "c-313", code: "3.1.3" },
  ]);
  prismaMock.documentType.create.mockImplementation(async ({ data }: { data: { code: string } }) => ({ id: `id-${data.code}` }));
});

describe("garde", () => {
  it("toute écriture passe par la garde d'administration, et s'arrête si elle refuse", async () => {
    requireCabinetAdminSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(createDocumentFolder("Stratégie RH")).rejects.toThrow("REDIRECT");
    await expect(renameDocumentFolder("f-1", "X")).rejects.toThrow("REDIRECT");
    await expect(setDocumentTypeFolder("dt-1", "f-1")).rejects.toThrow("REDIRECT");
    await expect(importDocumentTypes({ rows: [], category: "RH", provider: "EODA", folderId: "" })).rejects.toThrow("REDIRECT");
    await expect(previewDocumentTypeImport([], "RH")).rejects.toThrow("REDIRECT");
    expect(prismaMock.documentFolder.create).not.toHaveBeenCalled();
    expect(prismaMock.documentType.update).not.toHaveBeenCalled();
  });

  it("la lecture des dossiers est ouverte à tout rôle de cabinet, et n'écrit rien", async () => {
    prismaMock.documentFolder.findMany.mockResolvedValue([
      { id: "f-1", label: "Stratégie", position: 1, _count: { documentTypes: 2 } },
    ]);
    expect(await listDocumentFolders()).toEqual([{ id: "f-1", label: "Stratégie", position: 1, lineCount: 2 }]);
    expect(requireCabinetSession).toHaveBeenCalledWith("ANY_CABINET_ROLE");
  });
});

describe("createDocumentFolder / renameDocumentFolder", () => {
  it("crée à la suite des autres et journalise l'intitulé", async () => {
    const result = await createDocumentFolder("  Notes   de service ");
    expect(result).toEqual({ ok: true, folderId: "f-new", label: "Notes de service" });
    expect(prismaMock.documentFolder.create).toHaveBeenCalledWith({ data: { label: "Notes de service", position: 4 }, select: { id: true } });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_FOLDER_CREATED", targetId: "f-new" }));
  });

  it("refuse un doublon en le nommant", async () => {
    expect(await createDocumentFolder("strategie")).toEqual({ error: "Ce dossier existe déjà : « Stratégie »." });
    expect(prismaMock.documentFolder.create).not.toHaveBeenCalled();
  });

  it("refuse une entrée qui n'est pas du texte", async () => {
    expect(await createDocumentFolder(42)).toEqual({ error: "Valeur invalide." });
  });

  it("renommer un dossier inconnu répond notFound", async () => {
    prismaMock.documentFolder.findUnique.mockResolvedValue(null);
    await expect(renameDocumentFolder("f-x", "Pilotage")).rejects.toThrow("NOT_FOUND");
  });

  it("renomme et garde l'ancien nom au journal", async () => {
    prismaMock.documentFolder.findUnique.mockResolvedValue({ id: "f-1", label: "Process infra" });
    prismaMock.documentFolder.findMany.mockResolvedValue([{ label: "Stratégie" }]);
    expect(await renameDocumentFolder("f-1", "Process de la structure")).toEqual({ ok: true, label: "Process de la structure" });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_FOLDER_RENAMED", detail: "« Process infra » → « Process de la structure »" })
    );
  });
});

describe("setDocumentTypeFolder", () => {
  it("range une ligne dans un dossier existant", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-1", code: "EODA_X", folderId: null });
    prismaMock.documentFolder.findUnique.mockResolvedValue({ id: "f-1", label: "Stratégie" });
    expect(await setDocumentTypeFolder("dt-1", "f-1")).toEqual({ ok: true });
    expect(prismaMock.documentType.update).toHaveBeenCalledWith({ where: { id: "dt-1" }, data: { folderId: "f-1" } });
  });

  it("« aucun » remet la ligne à plat", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-1", code: "EODA_X", folderId: "f-1" });
    await setDocumentTypeFolder("dt-1", "");
    expect(prismaMock.documentType.update).toHaveBeenCalledWith({ where: { id: "dt-1" }, data: { folderId: null } });
  });

  it("ligne ou dossier inconnu : notFound, rien n'est écrit", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(setDocumentTypeFolder("dt-x", "f-1")).rejects.toThrow("NOT_FOUND");
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-1", code: "EODA_X", folderId: null });
    prismaMock.documentFolder.findUnique.mockResolvedValue(null);
    await expect(setDocumentTypeFolder("dt-1", "f-x")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.documentType.update).not.toHaveBeenCalled();
  });
});

describe("import d'un tableur", () => {
  const rows = [
    { label: "Exercice de crise", criteria: ["3-14-2"] },
    { label: "Bientraitance au quotidien", criteria: ["3.1.3"] },
    { label: "note de service", criteria: [] },
    { label: "Fiche inconnue", criteria: ["9.9.9"] },
  ];

  it("l'aperçu dit, ligne par ligne, ce qui serait créé — sans rien écrire", async () => {
    const result = await previewDocumentTypeImport(rows, "QUALITE_RISQUES");
    expect(result).toMatchObject({ ok: true });
    if (!("ok" in result)) return;
    expect(result.lines.map((line) => line.status)).toEqual(["NEW", "NEW", "DUPLICATE", "INVALID"]);
    expect(prismaMock.documentType.create).not.toHaveBeenCalled();
  });

  it("refuse la loi 2002-2 et une forme inattendue", async () => {
    expect(await previewDocumentTypeImport(rows, "LOI_2002_2")).toEqual({ error: "Catégorie invalide." });
    expect(await previewDocumentTypeImport("x", "RH")).toMatchObject({ error: expect.any(String) });
  });

  it("ne crée que les lignes neuves, dans le dossier, avec leurs critères, en une transaction", async () => {
    prismaMock.documentFolder.findUnique.mockResolvedValue({ id: "f-pro", label: "Sensibilisation des professionnels" });
    const result = await importDocumentTypes({ rows, category: "QUALITE_RISQUES", provider: "EODA", folderId: "f-pro" });
    expect(result).toEqual({ ok: true, created: 2, skipped: 2 });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentType.create).toHaveBeenCalledTimes(2);
    expect(prismaMock.documentType.create).toHaveBeenCalledWith({
      data: {
        code: "EODA_EXERCICE_DE_CRISE",
        category: "QUALITE_RISQUES",
        label: "Exercice de crise",
        requestedFromClient: false,
        folderId: "f-pro",
      },
      select: { id: true },
    });
    expect(prismaMock.documentTypeCriterion.createMany).toHaveBeenCalledWith({
      data: [{ documentTypeId: "id-EODA_EXERCICE_DE_CRISE", criterionId: "c-3142" }],
      skipDuplicates: true,
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_TYPES_IMPORTED" }));
  });

  it("un dossier inconnu répond notFound, rien n'est créé", async () => {
    prismaMock.documentFolder.findUnique.mockResolvedValue(null);
    await expect(importDocumentTypes({ rows, category: "RH", provider: "EODA", folderId: "f-x" })).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.documentType.create).not.toHaveBeenCalled();
  });

  it("rien de neuf : refus clair, aucune transaction", async () => {
    const result = await importDocumentTypes({
      rows: [{ label: "Note de service", criteria: [] }],
      category: "RH",
      provider: "EODA",
      folderId: "",
    });
    expect(result).toEqual({ error: "Aucune ligne neuve à créer." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
