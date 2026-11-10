import { beforeEach, describe, expect, it, vi } from "vitest";

// « Annuler le dépôt » (retour de Sandrine, 09/11/2026). Une action serveur ne
// s'interrompt pas : l'interface demande l'annulation, puis, dès que `uploadDocument`
// a rendu l'identifiant de la version, appelle `cancelDocumentDeposit`. Ce qui est
// vérifié ici :
//   - la garde est celle de la suppression d'une version (établissement PROPRIÉTAIRE,
//     résolu en base), et une mission close ou un accès révoqué refusent (comme le dépôt) ;
//   - seul l'AUTEUR du dépôt l'annule — une collègue du même côté est refusée ; une
//     structure n'annule plus un dépôt relu ou accepté depuis ;
//   - le retrait est VERROUILLÉ par condition (relecture de sécurité du 10/11/2026) : la
//     transaction ne bascule le document que s'il pointe encore cette version ; un dépôt
//     concurrent ou une seconde annulation rendent un message, jamais une 500 ;
//   - le stockage n'est supprimé qu'APRÈS la transaction réussie ;
//   - la validation posée par ce dépôt (« Version finale d'EODA ») n'est défaite que si
//     elle est encore celle du dépôt, et l'acceptation de la structure tombe avec elle.

type TxCallback<T> = (tx: unknown) => Promise<T>;

const prismaMock = {
  documentVersion: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  documentVersionImage: { findMany: vi.fn() },
  document: { update: vi.fn(), updateMany: vi.fn() },
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
const UPLOADED_AT = new Date("2026-11-10T10:00:00Z");
// Horodatage posé par `uploadDocument` sur la version ET sur le document quand le dépôt
// vaut validation (même `now`, même transaction).
const STAMP = new Date("2026-11-10T10:00:01Z");

type VersionOverrides = {
  uploadedByUserId?: string;
  currentVersionId?: string | null;
  validatedOnDeposit?: boolean;
  priorValidatedAt?: Date | null;
  priorValidatedByUserId?: string | null;
  documentValidatedAt?: Date | null;
  clientAcceptedAt?: Date | null;
};

function givenVersion(overrides: VersionOverrides = {}): void {
  const validatedOnDeposit = overrides.validatedOnDeposit ?? false;
  prismaMock.documentVersion.findUnique.mockResolvedValue({
    id: VERSION_ID,
    documentId: DOCUMENT_ID,
    uploadedByUserId: overrides.uploadedByUserId ?? "consultante-1",
    uploadedAt: UPLOADED_AT,
    analysisReviewedAt: validatedOnDeposit ? STAMP : null,
    fileStorageKey: "etab-1/doc/v2.pdf",
    validatedOnDeposit,
    priorValidatedAt: overrides.priorValidatedAt ?? null,
    priorValidatedByUserId: overrides.priorValidatedByUserId ?? null,
    document: {
      id: DOCUMENT_ID,
      establishmentId: ESTABLISHMENT_ID,
      currentVersionId: overrides.currentVersionId === undefined ? VERSION_ID : overrides.currentVersionId,
      validatedAt: overrides.documentValidatedAt === undefined ? (validatedOnDeposit ? STAMP : null) : overrides.documentValidatedAt,
      clientAcceptedAt: overrides.clientAcceptedAt ?? null,
      documentType: { code: "LIVRET_ACCUEIL" },
    },
  });
}

function cabinetAccess(userId = "consultante-1", missionAccess = "ACTIVE"): void {
  requireEstablishmentAccess.mockResolvedValue({
    establishmentId: ESTABLISHMENT_ID,
    userId,
    isClient: false,
    missionAccess,
    session: { user: { id: userId, role: "CABINET_ADMIN" } },
  });
}

function clientAccess(missionAccess = "ACTIVE"): void {
  requireEstablishmentAccess.mockResolvedValue({
    establishmentId: ESTABLISHMENT_ID,
    userId: "client-1",
    isClient: true,
    missionAccess,
    session: { user: { id: "client-1", role: "CLIENT_USER" } },
  });
}

// Les écritures de la transaction sur `document`, dans l'ordre.
function documentWrites(): { where: Record<string, unknown>; data: Record<string, unknown> }[] {
  return prismaMock.document.updateMany.mock.calls.map((call) => call[0] as { where: Record<string, unknown>; data: Record<string, unknown> });
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
  prismaMock.documentVersion.delete.mockResolvedValue({});
  prismaMock.documentVersionImage.findMany.mockResolvedValue([]);
  prismaMock.document.updateMany.mockResolvedValue({ count: 1 });
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

  it.each(["LIBRARY", "REVOKED"])("mission en état %s : refusé comme un dépôt, rien n'est touché", async (missionAccess) => {
    givenVersion({ uploadedByUserId: "client-1" });
    clientAccess(missionAccess);

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toHaveProperty("error");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(storageDelete).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("le cabinet non plus n'annule rien sur une mission close", async () => {
    givenVersion();
    cabinetAccess("consultante-1", "LIBRARY");

    expect(await cancelDocumentDeposit(VERSION_ID)).toHaveProperty("error");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
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

  it.each([
    ["relu par EODA", { documentValidatedAt: new Date("2026-11-10T10:05:00Z") }],
    ["accepté par la structure", { clientAcceptedAt: new Date("2026-11-10T10:05:00Z") }],
  ])("une structure n'annule plus un dépôt %s depuis — message clair, rien n'est touché", async (_label, overrides) => {
    givenVersion({ uploadedByUserId: "client-1", ...overrides });
    clientAccess();

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toMatchObject({ error: expect.stringContaining("relu ou accepté") });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(storageDelete).not.toHaveBeenCalled();
  });
});

describe("concurrence", () => {
  it("un autre dépôt est arrivé entre-temps : rien n'est annulé, le stockage n'est pas touché", async () => {
    givenVersion();
    prismaMock.document.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ error: "Un autre dépôt est arrivé : rien n'a été annulé." });
    expect(documentWrites()[0]?.where).toEqual({ id: DOCUMENT_ID, currentVersionId: VERSION_ID });
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
    expect(storageDelete).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("une seconde annulation concurrente (ligne déjà supprimée, P2025) rend un message, jamais une erreur serveur", async () => {
    givenVersion();
    prismaMock.documentVersion.delete.mockRejectedValueOnce(Object.assign(new Error("Record to delete does not exist."), { code: "P2025" }));

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ error: "Ce dépôt a déjà été annulé." });
    expect(storageDelete).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("une autre erreur de base n'est pas masquée", async () => {
    givenVersion();
    prismaMock.documentVersion.delete.mockRejectedValueOnce(new Error("connexion perdue"));

    await expect(cancelDocumentDeposit(VERSION_ID)).rejects.toThrow("connexion perdue");
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("le stockage n'est supprimé qu'APRÈS la transaction réussie", async () => {
    givenVersion();

    await cancelDocumentDeposit(VERSION_ID);

    const deletedRowAt = prismaMock.documentVersion.delete.mock.invocationCallOrder[0] ?? Infinity;
    const deletedFileAt = storageDelete.mock.invocationCallOrder[0] ?? -Infinity;
    expect(deletedFileAt).toBeGreaterThan(deletedRowAt);
  });

  it("un échec du stockage APRÈS la transaction ne ment pas : la version est retirée, l'objet orphelin est signalé", async () => {
    givenVersion();
    storageDelete.mockRejectedValue(new Error("bucket indisponible"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "UNCHANGED" });
    expect(consoleError).toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_DEPOSIT_CANCELLED" }));
  });
});

describe("annulation", () => {
  it("retire la version (ligne, stockage, rendu en cache) et journalise l'annulation", async () => {
    givenVersion();

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "UNCHANGED" });
    expect(storageDelete).toHaveBeenCalledWith("etab-1/doc/v2.pdf");
    expect(deleteCachedDocumentPdf).toHaveBeenCalledWith(VERSION_ID);
    expect(prismaMock.documentVersion.delete).toHaveBeenCalledWith({ where: { id: VERSION_ID } });
    expect(documentWrites()[0]?.data).toEqual(expect.objectContaining({ currentVersionId: "version-1", status: "UPLOADED" }));
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

  it("dernière version retirée : le document redevient manquant", async () => {
    givenVersion();
    prismaMock.documentVersion.findFirst.mockResolvedValue(null);

    await cancelDocumentDeposit(VERSION_ID);

    expect(documentWrites()[0]?.data).toEqual(expect.objectContaining({ currentVersionId: null, status: "MISSING" }));
  });

  it("dépôt sans validation : la validation du document n'est pas touchée", async () => {
    givenVersion();

    await cancelDocumentDeposit(VERSION_ID);

    expect(documentWrites()).toHaveLength(1);
    expect(documentWrites()[0]?.data).not.toHaveProperty("validatedAt");
    expect(recordAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_UNVALIDATED" }));
  });

  it("dépôt « Version finale » sur un document non validé : la validation (et l'acceptation) sont retirées sous condition, et tracées", async () => {
    givenVersion({ validatedOnDeposit: true });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "REMOVED" });
    expect(documentWrites()[1]).toEqual({
      // Seulement si la validation est ENCORE celle posée par ce dépôt.
      where: { id: DOCUMENT_ID, validatedAt: STAMP },
      data: { validatedAt: null, validatedByUserId: null, clientAcceptedAt: null, clientAcceptedByUserId: null },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_UNVALIDATED", targetId: DOCUMENT_ID })
    );
  });

  it("dépôt « Version finale » sur un document déjà validé : la validation d'avant est rétablie, l'acceptation retirée", async () => {
    givenVersion({ validatedOnDeposit: true, priorValidatedAt: PRIOR, priorValidatedByUserId: "consultante-3" });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "RESTORED" });
    expect(documentWrites()[1]).toEqual({
      where: { id: DOCUMENT_ID, validatedAt: STAMP },
      data: { validatedAt: PRIOR, validatedByUserId: "consultante-3", clientAcceptedAt: null, clientAcceptedByUserId: null },
    });
  });

  it("re-validé par quelqu'un d'autre entre-temps : la validation n'est pas touchée, et rien ne le prétend", async () => {
    givenVersion({ validatedOnDeposit: true });
    // La condition `validatedAt = STAMP` ne trouve plus rien.
    prismaMock.document.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    const result = await cancelDocumentDeposit(VERSION_ID);

    expect(result).toEqual({ cancelled: true, validation: "UNCHANGED" });
    expect(recordAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_UNVALIDATED" }));
  });

  it("rétablit la date même si le compte qui avait validé n'existe plus", async () => {
    givenVersion({ validatedOnDeposit: true, priorValidatedAt: PRIOR, priorValidatedByUserId: "disparue" });
    prismaMock.user.findUnique.mockImplementation(async (args: { where: { id: string } }) =>
      args.where.id === "disparue" ? null : { id: args.where.id, role: "CABINET_ADMIN" }
    );

    await cancelDocumentDeposit(VERSION_ID);

    expect(documentWrites()[1]?.data).toEqual(expect.objectContaining({ validatedAt: PRIOR, validatedByUserId: null }));
  });

  it("une structure annule son propre dépôt, même sur un document validé AVANT ce dépôt", async () => {
    givenVersion({ uploadedByUserId: "client-1", documentValidatedAt: PRIOR, clientAcceptedAt: PRIOR });
    clientAccess();

    expect(await cancelDocumentDeposit(VERSION_ID)).toEqual({ cancelled: true, validation: "UNCHANGED" });
    expect(prismaMock.documentVersion.delete).toHaveBeenCalled();
  });
});
