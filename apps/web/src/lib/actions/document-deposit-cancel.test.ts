import { beforeEach, describe, expect, it, vi } from "vitest";

// « Annuler le dépôt » (retour de Sandrine, 09/11/2026). Une action serveur ne
// s'interrompt pas : l'interface demande l'annulation, puis, dès que `uploadDocument`
// a rendu l'identifiant de la version, appelle `cancelDocumentDeposit`. Ce qui est
// vérifié ici :
//   - la garde est celle de la suppression d'une version (établissement PROPRIÉTAIRE,
//     résolu en base) ;
//   - seul l'AUTEUR du dépôt l'annule — une collègue du même côté est refusée ;
//   - la version est retirée par le même chemin que la suppression (stockage, rendu
//     en cache, ligne), et un échec du stockage n'efface rien ;
//   - la validation posée par ce dépôt (« Version finale d'EODA ») est défaite :
//     rétablie si le document l'était avant, retirée sinon.

type TxCallback<T> = (tx: unknown) => Promise<T>;

const prismaMock = {
  documentVersion: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  documentVersionImage: { findMany: vi.fn() },
  document: { update: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

const requireEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();
const storageDelete = vi.fn();
const deleteCachedDocumentPdf = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
  tryEstablishmentAccess: vi.fn(),
}));
vi.mock("@/lib/services/document-ingestion-service", () => ({ ingestDocumentVersion: vi.fn() }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/services/document-pdf-cache", () => ({
  deleteCachedDocumentPdf: (...args: unknown[]) => deleteCachedDocumentPdf(...args),
}));
vi.mock("@/lib/storage", () => ({
  getFileStoragePort: () => ({ delete: (...args: unknown[]) => storageDelete(...args) }),
}));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}), isKnownLlmModelId: () => false }));

const { cancelDocumentDeposit } = await import("./document");

const VERSION_ID = "version-2";
const DOCUMENT_ID = "document-1";
const ESTABLISHMENT_ID = "etab-1";
const PRIOR = new Date("2026-11-01T09:00:00Z");

type VersionOverrides = {
  uploadedByUserId?: string;
  currentVersionId?: string | null;
  validatedOnDeposit?: boolean;
  priorValidatedAt?: Date | null;
  priorValidatedByUserId?: string | null;
};

function givenVersion(overrides: VersionOverrides = {}): void {
  prismaMock.documentVersion.findUnique.mockResolvedValue({
    id: VERSION_ID,
    documentId: DOCUMENT_ID,
    uploadedByUserId: overrides.uploadedByUserId ?? "consultante-1",
    fileStorageKey: "etab-1/doc/v2.pdf",
    validatedOnDeposit: overrides.validatedOnDeposit ?? false,
    priorValidatedAt: overrides.priorValidatedAt ?? null,
    priorValidatedByUserId: overrides.priorValidatedByUserId ?? null,
    document: {
      id: DOCUMENT_ID,
      establishmentId: ESTABLISHMENT_ID,
      currentVersionId: overrides.currentVersionId === undefined ? VERSION_ID : overrides.currentVersionId,
      documentType: { code: "LIVRET_ACCUEIL" },
    },
  });
}

function cabinetAccess(userId = "consultante-1"): void {
  requireEstablishmentAccess.mockResolvedValue({
    establishmentId: ESTABLISHMENT_ID,
    userId,
    isClient: false,
    missionAccess: "ACTIVE",
    session: { user: { id: userId, role: "CABINET_ADMIN" } },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cabinetAccess();
  // L'auteur du dépôt est du cabinet, et (pour la restauration) le compte existe.
  prismaMock.user.findUnique.mockImplementation(async (args: { where: { id: string } }) =>
    args.where.id.startsWith("client") ? { id: args.where.id, role: "CLIENT_USER" } : { id: args.where.id, role: "CABINET_ADMIN" }
  );
  storageDelete.mockResolvedValue(undefined);
  deleteCachedDocumentPdf.mockResolvedValue(undefined);
  prismaMock.documentVersion.findFirst.mockResolvedValue({ id: "version-1" });
  prismaMock.documentVersionImage.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(async (arg: TxCallback<unknown>) => arg(prismaMock));
});

describe("refus", () => {
  it("refuse un identifiant vide sans interroger la base", async () => {
    expect(await cancelDocumentDeposit("")).toEqual({ error: "Version de document invalide." });
    expect(prismaMock.documentVersion.findUnique).not.toHaveBeenCalled();
  });

  it("version inexistante : notFound, rien n'est touché", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(null);
    await expect(cancelDocumentDeposit("inconnue")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("propage le refus de la garde (établissement hors périmètre) sans rien toucher", async () => {
    givenVersion();
    requireEstablishmentAccess.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(cancelDocumentDeposit(VERSION_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(requireEstablishmentAccess).toHaveBeenCalledWith(ESTABLISHMENT_ID, expect.anything());
    expect(storageDelete).not.toHaveBeenCalled();
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
  });

  it("une autre consultante ne peut pas annuler le dépôt d'une collègue", async () => {
    givenVersion({ uploadedByUserId: "consultante-2" });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toMatchObject({ error: expect.stringContaining("que votre propre dépôt") });
    expect(storageDelete).not.toHaveBeenCalled();
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("le cabinet ne peut pas annuler le dépôt d'une structure", async () => {
    givenVersion({ uploadedByUserId: "client-1" });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toHaveProperty("error");
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
  });

  it("refuse une version qui n'est plus la dernière", async () => {
    givenVersion({ currentVersionId: "version-3" });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toMatchObject({ error: expect.stringContaining("n'est plus la dernière") });
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
  });

  it("conserve tout quand le stockage refuse la suppression", async () => {
    givenVersion({ validatedOnDeposit: true });
    storageDelete.mockRejectedValue(new Error("bucket indisponible"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toMatchObject({ error: expect.stringContaining("Rien n'a été effacé") });
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
    expect(prismaMock.document.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("annulation", () => {
  it("retire la version (stockage, rendu en cache, ligne) et journalise l'annulation", async () => {
    givenVersion();

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "UNCHANGED" });
    expect(storageDelete).toHaveBeenCalledWith("etab-1/doc/v2.pdf");
    expect(deleteCachedDocumentPdf).toHaveBeenCalledWith(VERSION_ID);
    expect(prismaMock.documentVersion.delete).toHaveBeenCalledWith({ where: { id: VERSION_ID } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DOCUMENT_DEPOSIT_CANCELLED",
        actorUserId: "consultante-1",
        establishmentId: ESTABLISHMENT_ID,
        targetId: VERSION_ID,
        detail: "LIVRET_ACCUEIL",
      })
    );
  });

  it("dépôt sans validation : la validation du document n'est pas touchée", async () => {
    givenVersion();

    await cancelDocumentDeposit(VERSION_ID);

    const data = (prismaMock.document.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data).not.toHaveProperty("validatedAt");
    expect(recordAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_UNVALIDATED" }));
  });

  it("dépôt « Version finale » sur un document non validé : la validation est retirée, et tracée", async () => {
    givenVersion({ validatedOnDeposit: true });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "REMOVED" });
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOCUMENT_ID },
        data: expect.objectContaining({ currentVersionId: "version-1", validatedAt: null, validatedByUserId: null }),
      })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_UNVALIDATED", targetId: DOCUMENT_ID })
    );
  });

  it("dépôt « Version finale » sur un document déjà validé : la validation d'avant est rétablie", async () => {
    givenVersion({ validatedOnDeposit: true, priorValidatedAt: PRIOR, priorValidatedByUserId: "consultante-3" });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "RESTORED" });
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ validatedAt: PRIOR, validatedByUserId: "consultante-3" }),
      })
    );
  });

  it("rétablit la date même si le compte qui avait validé n'existe plus", async () => {
    givenVersion({ validatedOnDeposit: true, priorValidatedAt: PRIOR, priorValidatedByUserId: "disparue" });
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { id: string } }) =>
      args.where.id === "disparue" ? null : { id: args.where.id, role: "CABINET_ADMIN" }
    );

    await cancelDocumentDeposit(VERSION_ID);

    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ validatedAt: PRIOR, validatedByUserId: null }) })
    );
  });

  it("une structure annule son propre dépôt", async () => {
    givenVersion({ uploadedByUserId: "client-1" });
    requireEstablishmentAccess.mockResolvedValue({
      establishmentId: ESTABLISHMENT_ID,
      userId: "client-1",
      isClient: true,
      missionAccess: "ACTIVE",
      session: { user: { id: "client-1", role: "CLIENT_USER" } },
    });

    expect(await cancelDocumentDeposit(VERSION_ID)).toEqual({ cancelled: true, validation: "UNCHANGED" });
    expect(prismaMock.documentVersion.delete).toHaveBeenCalled();
  });
});
