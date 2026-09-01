import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS et effets de bord de la suppression d'une version de document (D7).
// Ce qui est vérifié ici :
//   - l'habilitation porte sur l'établissement PROPRIÉTAIRE de la version, résolu en
//     base, jamais sur un identifiant fourni par l'appelant ;
//   - un échec du stockage n'efface PAS la ligne (sinon le fichier survit sans plus
//     aucune trace pour le retrouver — le défaut RGPD qu'on corrige) ;
//   - la suppression de la dernière version repasse le document en MISSING, pour ne
//     pas laisser une checklist annoncer « conforme » sans aucune preuve.

type TxCallback<T> = (tx: unknown) => Promise<T>;

const prismaMock = {
  documentVersion: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  document: { update: vi.fn() },
  // Le rôle de l'AUTEUR du dépôt décide qui peut le supprimer.
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
};

const requireEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();
const storageDelete = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
  tryEstablishmentAccess: vi.fn(),
  requireEstablishmentInTenant: vi.fn(),
}));
vi.mock("@/lib/services/text-extraction-service", () => ({ extractText: vi.fn() }));
vi.mock("@/lib/services/document-categorization-service", () => ({ suggestDocumentType: vi.fn() }));
vi.mock("@/lib/services/document-ingestion-service", () => ({ ingestDocumentVersion: vi.fn() }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/upload-validation-service", () => ({ validateUploadedFile: vi.fn() }));
vi.mock("@/lib/services/establishment-offer-service", () => ({
  getEstablishmentCoveredCategories: vi.fn(),
  isCategoryCoveredForEstablishment: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({
  getFileStoragePort: () => ({ delete: (...args: unknown[]) => storageDelete(...args) }),
}));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}) }));

const { deleteDocumentVersion } = await import("./document");

const VERSION_ID = "version-1";
const DOCUMENT_ID = "document-1";
const ESTABLISHMENT_ID = "etab-1";

function givenVersion(currentVersionId: string | null = VERSION_ID): void {
  prismaMock.documentVersion.findUnique.mockResolvedValue({
    id: VERSION_ID,
    documentId: DOCUMENT_ID,
    uploadedByUserId: "user-cabinet",
    fileStorageKey: "etab-1/doc/v1.pdf",
    document: {
      id: DOCUMENT_ID,
      establishmentId: ESTABLISHMENT_ID,
      currentVersionId,
      documentType: { code: "DIPC" },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue({
    establishmentId: ESTABLISHMENT_ID,
    userId: "user-cabinet",
    isClient: false,
    missionAccess: "ACTIVE",
    session: { user: { id: "user-cabinet", role: "CABINET_ADMIN" } },
  });
  // Par défaut : version produite par le cabinet, supprimable par le cabinet.
  prismaMock.user.findUnique.mockResolvedValue({ role: "CABINET_ADMIN" });
  storageDelete.mockResolvedValue(undefined);
  prismaMock.documentVersion.findFirst.mockResolvedValue(null);
  prismaMock.$transaction.mockImplementation(async (arg: TxCallback<unknown>) => arg(prismaMock));
});

describe("refus", () => {
  it("refuse un identifiant vide sans interroger la base", async () => {
    const result = await deleteDocumentVersion("");

    expect(result).toEqual({ error: "Version de document invalide." });
    expect(prismaMock.documentVersion.findUnique).not.toHaveBeenCalled();
  });

  it("refuse une version inexistante", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(null);

    const result = await deleteDocumentVersion("inconnue");

    expect(result).toEqual({ error: "Version de document introuvable." });
    expect(storageDelete).not.toHaveBeenCalled();
  });

  it("propage le refus de la garde et ne touche ni au stockage ni à la base", async () => {
    givenVersion();
    requireEstablishmentAccess.mockRejectedValue(new Error("NOT_FOUND"));

    await expect(deleteDocumentVersion(VERSION_ID)).rejects.toThrow("NOT_FOUND");
    expect(storageDelete).not.toHaveBeenCalled();
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
  });

  it("conserve la ligne quand la suppression de l'objet stocké échoue", async () => {
    givenVersion();
    storageDelete.mockRejectedValue(new Error("bucket indisponible"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await deleteDocumentVersion(VERSION_ID);

    expect(result).toMatchObject({ error: expect.stringContaining("Rien n'a été effacé") });
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("suppression", () => {
  it("repasse le document en MISSING quand c'était la dernière version", async () => {
    givenVersion();

    const result = await deleteDocumentVersion(VERSION_ID);

    expect(result).toBeNull();
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentVersionId: null,
          status: "MISSING",
          statusOverriddenByUser: false,
        }),
      })
    );
    expect(prismaMock.documentVersion.delete).toHaveBeenCalledWith({ where: { id: VERSION_ID } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_VERSION_DELETED", targetId: VERSION_ID })
    );
  });

  it("remet la version précédente en courant, en statut déposé", async () => {
    givenVersion();
    prismaMock.documentVersion.findFirst.mockResolvedValue({ id: "version-0" });

    await deleteDocumentVersion(VERSION_ID);

    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentVersionId: "version-0", status: "UPLOADED" }),
      })
    );
  });

  // Le cas « supprimer une version antérieure » n'existe plus : il est désormais
  // refusé (cf. « qui peut supprimer quoi » plus bas). Supprimer une version qui n'est
  // pas la dernière n'est pas une correction, c'est une réécriture de l'historique —
  // et l'historique complet est précisément ce que Sandrine a demandé à voir.
});

describe("qui peut supprimer quoi", () => {
  it("refuse au cabinet la suppression d'un document déposé par le client", async () => {
    // « Moi, je prends ce qu'ils me donnent » — le refus est côté serveur, pas
    // seulement un bouton masqué.
    givenVersion();
    prismaMock.user.findUnique.mockResolvedValue({ role: "CLIENT_USER" });

    const result = await deleteDocumentVersion(VERSION_ID);

    expect(result).toMatchObject({ error: expect.stringContaining("appartient") });
    expect(storageDelete).not.toHaveBeenCalled();
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
  });

  it("laisse le client retirer son propre dernier dépôt", async () => {
    givenVersion();
    prismaMock.user.findUnique.mockResolvedValue({ role: "CLIENT_USER" });
    requireEstablishmentAccess.mockResolvedValue({
      establishmentId: ESTABLISHMENT_ID,
      userId: "user-client",
      isClient: true,
      missionAccess: "ACTIVE",
      session: { user: { id: "user-client", role: "CLIENT_USER" } },
    });

    const result = await deleteDocumentVersion(VERSION_ID);

    expect(result).toBeNull();
    expect(prismaMock.documentVersion.delete).toHaveBeenCalled();
  });

  it("refuse la suppression d'une version qui n'est plus la courante", async () => {
    givenVersion("autre-version");

    const result = await deleteDocumentVersion(VERSION_ID);

    expect(result).toMatchObject({ error: expect.stringContaining("dernière") });
    expect(prismaMock.documentVersion.delete).not.toHaveBeenCalled();
  });
});
