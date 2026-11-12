import { beforeEach, describe, expect, it, vi } from "vitest";

// Signer et tamponner un document accepté (12/11/2026). Ce qui est protégé ici : la
// DIRECTION de la structure seulement, jamais le cabinet ; un document accepté et à
// jour ; une seule copie signée, sur la version COURANTE ; le même format que
// l'original ; rien d'enregistré sans marque. Les règles pures tournent pour de vrai.

const prismaMock = {
  document: { findUnique: vi.fn(), findFirst: vi.fn() },
  documentVersion: { updateMany: vi.fn() },
};
const requireEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();
const storage = { upload: vi.fn(), delete: vi.fn(), download: vi.fn(), getSignedDownloadUrl: vi.fn() };
const validateUploadOnServer = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: unknown[]) => requireEstablishmentAccess(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => storage }));
vi.mock("@/lib/security/office-archive-guard", () => ({
  validateUploadOnServer: (...args: unknown[]) => validateUploadOnServer(...args),
}));

const { getDocumentSigningContext, saveSignedDocument } = await import("./document-signature");

const ETAB = "etab-fictif";
const TYPE = "dt-plaintes";
const UPLOADED = new Date("2026-11-01T10:00:00Z");
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const DIRECTION = {
  userId: "user-direction",
  isClient: true,
  clientAccessRole: "DIRECTION",
  session: { user: { role: "CLIENT_USER" } },
  missionAccess: "ACTIVE",
};

function givenDocument(overrides: { clientAcceptedAt?: Date | null; signedAt?: Date | null; filename?: string; code?: string } = {}) {
  prismaMock.document.findUnique.mockResolvedValue({
    clientAcceptedAt: overrides.clientAcceptedAt === undefined ? new Date("2026-11-05") : overrides.clientAcceptedAt,
    documentType: { code: overrides.code ?? "QUALITE_PROCEDURE_PLAINTES", label: "Procédure de gestion des plaintes" },
    currentVersion: {
      id: "v-3",
      versionNumber: 3,
      originalFilename: overrides.filename ?? "plaintes.docx",
      uploadedAt: UPLOADED,
      signedAt: overrides.signedAt ?? null,
    },
  });
}

function form(patch: Record<string, string | File | null> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string | File | null> = {
    establishmentId: ETAB,
    documentTypeId: TYPE,
    versionId: "v-3",
    marks: "SIGNATURE,TAMPON",
    file: new File([new Uint8Array([0x50, 0x4b, 3, 4])], "plaintes-signe.docx"),
    ...patch,
  };
  for (const [key, value] of Object.entries(fields)) if (value !== null) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue(DIRECTION);
  givenDocument();
  prismaMock.document.findFirst.mockResolvedValue({ currentVersionId: "v-tampon" });
  prismaMock.documentVersion.updateMany.mockResolvedValue({ count: 1 });
  validateUploadOnServer.mockReturnValue({ ok: true, contentType: DOCX });
  storage.upload.mockResolvedValue(undefined);
  storage.delete.mockResolvedValue(undefined);
});

describe("getDocumentSigningContext", () => {
  it("la direction : document signable, et le dernier dépôt du tampon", async () => {
    const context = await getDocumentSigningContext(ETAB, TYPE);
    expect(context).toMatchObject({ versionId: "v-3", kind: "DOCX", refusal: null, tamponVersionId: "v-tampon" });
    expect(requireEstablishmentAccess).toHaveBeenCalledWith(ETAB, expect.anything());
  });

  it("une responsable qualité : le refus est dit, le tampon n'est même pas cherché", async () => {
    requireEstablishmentAccess.mockResolvedValue({ ...DIRECTION, clientAccessRole: "RESPONSABLE_QUALITE" });
    const context = await getDocumentSigningContext(ETAB, TYPE);
    expect(context.refusal).toMatch(/direction/);
    expect(context.tamponVersionId).toBeNull();
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
  });

  it("le cabinet ne signe jamais pour la structure", async () => {
    requireEstablishmentAccess.mockResolvedValue({ ...DIRECTION, isClient: false, clientAccessRole: null });
    await expect(getDocumentSigningContext(ETAB, TYPE)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("un document sans version : introuvable", async () => {
    prismaMock.document.findUnique.mockResolvedValue({ clientAcceptedAt: null, documentType: null, currentVersion: null });
    await expect(getDocumentSigningContext(ETAB, TYPE)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("saveSignedDocument — cas nominal", () => {
  it("range la copie SUR la version courante, une seule fois, et journalise sans le fichier", async () => {
    const result = await saveSignedDocument(form());
    expect(result).toEqual({ signedAt: expect.any(Date) });

    const key = storage.upload.mock.calls[0]![0] as string;
    expect(key).toMatch(new RegExp(`^${ETAB}/${TYPE}/v3-\\d+-plaintes-signe\\.docx$`));
    expect(prismaMock.documentVersion.updateMany).toHaveBeenCalledWith({
      where: { id: "v-3", signedAt: null, currentForDocument: { isNot: null } },
      data: { signedFileStorageKey: key, signedAt: expect.any(Date), signedByUserId: "user-direction" },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DOCUMENT_SIGNED_BY_CLIENT",
        targetId: "v-3",
        detail: "QUALITE_PROCEDURE_PLAINTES · 1 signature(s), 1 tampon(s)",
      })
    );
  });
});

describe("saveSignedDocument — refus", () => {
  it.each([
    ["responsable qualité", () => requireEstablishmentAccess.mockResolvedValue({ ...DIRECTION, clientAccessRole: "RESPONSABLE_QUALITE" }), /direction/],
    ["mission close", () => requireEstablishmentAccess.mockResolvedValue({ ...DIRECTION, missionAccess: "LIBRARY" }), /terminé/],
    ["pas encore accepté", () => givenDocument({ clientAcceptedAt: null }), /Acceptez/],
    ["acceptation périmée", () => givenDocument({ clientAcceptedAt: new Date("2026-10-01") }), /Acceptez/],
    ["déjà signé", () => givenDocument({ signedAt: new Date("2026-11-06") }), /déjà signé/],
    ["tableur", () => givenDocument({ filename: "plan.xlsx" }), /Word/],
    ["le tampon lui-même", () => givenDocument({ code: "DEPARTEMENT_TAMPON" }), /ne se signe pas/],
  ])("%s → refusé, rien de stocké", async (_label, arrange, message) => {
    arrange();
    const result = await saveSignedDocument(form());
    expect(result).toEqual({ error: expect.stringMatching(message) });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(prismaMock.documentVersion.updateMany).not.toHaveBeenCalled();
  });

  it("une autre version que la courante (dépôt arrivé entre-temps)", async () => {
    const result = await saveSignedDocument(form({ versionId: "v-2" }));
    expect(result).toEqual({ error: expect.stringMatching(/nouveau dépôt/) });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("aucune marque posée", async () => {
    expect(await saveSignedDocument(form({ marks: "" }))).toEqual({ error: expect.stringMatching(/au moins/) });
  });

  it("un PDF envoyé pour un Word : refusé", async () => {
    validateUploadOnServer.mockReturnValue({ ok: true, contentType: "application/pdf" });
    expect(await saveSignedDocument(form())).toEqual({ error: expect.stringMatching(/même format/) });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("un fichier invalide : l'erreur de la validation", async () => {
    validateUploadOnServer.mockReturnValue({ ok: false, error: "Le fichier est vide." });
    expect(await saveSignedDocument(form())).toEqual({ error: "Le fichier est vide." });
  });

  it("deux onglets : la seconde copie est retirée du stockage, rien n'est écrasé", async () => {
    prismaMock.documentVersion.updateMany.mockResolvedValue({ count: 0 });
    const result = await saveSignedDocument(form());
    expect(result).toEqual({ error: expect.stringMatching(/déjà signé/) });
    expect(storage.delete).toHaveBeenCalledWith(storage.upload.mock.calls[0]![0]);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("le cabinet : introuvable", async () => {
    requireEstablishmentAccess.mockResolvedValue({ ...DIRECTION, isClient: false, clientAccessRole: null });
    await expect(saveSignedDocument(form())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("identifiants absents : introuvable avant toute garde", async () => {
    await expect(saveSignedDocument(form({ establishmentId: null }))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(requireEstablishmentAccess).not.toHaveBeenCalled();
  });
});
