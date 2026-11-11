import { beforeEach, describe, expect, it, vi } from "vitest";

// Mise en page des documents d'une structure (11/11/2026). Cabinet, structure de son
// périmètre ; modèle Word vérifié par signature ; clé de stockage sans nom d'origine ;
// journal sans le texte des consignes.

const prismaMock = {
  establishmentDocumentDesign: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
};
const requireEstablishmentInTenant = vi.fn();
const recordAuditEvent = vi.fn();
const upload = vi.fn();
const remove = vi.fn().mockResolvedValue(undefined);
const validateUploadOnServer = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (id: string, mode: string) => requireEstablishmentInTenant(id, mode),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({ upload, delete: remove }) }));
vi.mock("@/lib/security/office-archive-guard", () => ({
  validateUploadOnServer: (...a: unknown[]) => validateUploadOnServer(...a),
}));

const { saveDocumentDesignNotes, uploadDocumentDesignModel, removeDocumentDesignModel, getDocumentDesign } = await import(
  "./document-design"
);
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function form(file: File | null): FormData {
  const data = new FormData();
  data.set("establishmentId", "etab-1");
  if (file) data.set("file", file);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({
    userId: "u-eval",
    session: { user: { role: "CABINET_EVALUATOR" } },
    establishmentId: "etab-1",
  });
  validateUploadOnServer.mockReturnValue({ ok: true, contentType: DOCX });
  prismaMock.establishmentDocumentDesign.findUnique.mockResolvedValue(null);
});

describe("saveDocumentDesignNotes", () => {
  it("enregistre les consignes pour CETTE structure, journal sans le texte", async () => {
    expect(await saveDocumentDesignNotes("etab-1", "  Titres en majuscules, police Arial  ")).toBeNull();
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "WRITE");
    expect(prismaMock.establishmentDocumentDesign.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ notes: "Titres en majuscules, police Arial" }) })
    );
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("Arial");
  });

  it("refuse des consignes trop longues", async () => {
    expect(await saveDocumentDesignNotes("etab-1", "a".repeat(4001))).toMatchObject({ error: expect.any(String) });
    expect(prismaMock.establishmentDocumentDesign.upsert).not.toHaveBeenCalled();
  });

  it("structure hors périmètre ou compte client : refusé avant toute écriture", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(saveDocumentDesignNotes("autre", "x")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.establishmentDocumentDesign.upsert).not.toHaveBeenCalled();
  });
});

describe("uploadDocumentDesignModel", () => {
  it("range le modèle sous une clé sans nom d'origine et retire l'ancien", async () => {
    prismaMock.establishmentDocumentDesign.findUnique.mockResolvedValue({ modelFileKey: "designs/etab-1/ancien.docx" });
    const file = new File([new Uint8Array([0x50, 0x4b, 3, 4])], "../../papier en-tête.docx");
    expect(await uploadDocumentDesignModel(form(file))).toBeNull();
    const key = upload.mock.calls[0]?.[0] as string;
    expect(key).toMatch(/^designs\/etab-1\/[0-9a-f-]{36}\.docx$/);
    expect(key).not.toContain("papier");
    expect(remove).toHaveBeenCalledWith("designs/etab-1/ancien.docx");
  });

  it("refuse ce qui n'est pas un Word, d'après la signature", async () => {
    validateUploadOnServer.mockReturnValue({ ok: true, contentType: "application/pdf" });
    const file = new File([new Uint8Array([0x25, 0x50])], "modele.docx");
    expect(await uploadDocumentDesignModel(form(file))).toMatchObject({ error: expect.stringContaining("Word") });
    expect(upload).not.toHaveBeenCalled();
  });

  it("sans fichier : rien n'est écrit", async () => {
    expect(await uploadDocumentDesignModel(form(null))).toMatchObject({ error: expect.any(String) });
    expect(upload).not.toHaveBeenCalled();
  });
});

describe("removeDocumentDesignModel / getDocumentDesign", () => {
  it("retire le modèle et son fichier", async () => {
    prismaMock.establishmentDocumentDesign.findUnique.mockResolvedValue({ modelFileKey: "designs/etab-1/m.docx" });
    expect(await removeDocumentDesignModel("etab-1")).toBeNull();
    expect(prismaMock.establishmentDocumentDesign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modelFileKey: null }) })
    );
    expect(remove).toHaveBeenCalledWith("designs/etab-1/m.docx");
  });

  it("lecture en mode READ", async () => {
    await getDocumentDesign("etab-1");
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "READ");
  });
});
