import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileStoragePort } from "@/lib/storage";
import type { LLMAnalysisPort } from "@/lib/llm";

// Stockage des images extraites d'un document (.docx) — best-effort : le point
// central de la tâche D4. Une image dont l'upload, la description ou
// l'enregistrement échoue ne doit JAMAIS empêcher les autres images de se
// stocker, ni le dépôt du document lui-même de se terminer normalement. Seule
// la fonction réelle `ingestDocumentVersion` (pas un mock du câblage côté
// action serveur) peut vérifier cette propriété — cf. revue de la tâche D4.

const prismaMock = {
  document: { upsert: vi.fn(), update: vi.fn() },
  documentVersion: { create: vi.fn() },
  documentVersionImage: { create: vi.fn() },
};

const describeImage = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/services/image-vision-service", () => ({
  describeImage: (...args: unknown[]) => describeImage(...args),
}));

const { ingestDocumentVersion, MAX_IMAGES_DESCRIBED, MAX_IMAGE_SIZE_BYTES } = await import(
  "./document-ingestion-service"
);

const ESTABLISHMENT_ID = "etab-1";
const DOCUMENT_TYPE_ID = "dt-1";

function baseInput(overrides: Partial<Parameters<typeof ingestDocumentVersion>[0]> = {}) {
  return {
    establishmentId: ESTABLISHMENT_ID,
    documentTypeId: DOCUMENT_TYPE_ID,
    documentTypeLabel: "Livret d'accueil",
    content: Buffer.from("contenu"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    originalFilename: "livret.docx",
    uploadedByUserId: "user-1",
    // Pas de texte à analyser : ce test porte sur le stockage des images, pas
    // sur l'analyse IA — la garder hors du chemin testé évite de mocker le port
    // LLM et la base de connaissances, non pertinents ici.
    extractedText: null,
    ...overrides,
  };
}

function fakeStorage(overrides: Partial<FileStoragePort> = {}): FileStoragePort {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    getSignedDownloadUrl: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as FileStoragePort;
}

const noopLlm = { analyze: vi.fn() } as unknown as LLMAnalysisPort;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.document.upsert.mockResolvedValue({ id: "doc-1", versions: [] });
  prismaMock.documentVersion.create.mockResolvedValue({ id: "dv-1" });
  prismaMock.document.update.mockResolvedValue({});
  prismaMock.documentVersionImage.create.mockResolvedValue({});
});

describe("ingestDocumentVersion — stockage best-effort des images extraites", () => {
  it("stocke une image extraite et sa description sans bloquer le dépôt si la description échoue", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue(null); // échec de la description, best-effort

    const image = { position: 1, contentType: "image/png", buffer: Buffer.from("x") };
    const result = await ingestDocumentVersion(
      baseInput({ extractedImages: [image] }),
      { storage, llm: noopLlm }
    );

    expect(result.documentVersionId).toBe("dv-1");
    // Un appel pour le fichier lui-même, un second pour l'image extraite.
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        documentVersionId: "dv-1",
        position: 1,
        contentType: "image/png",
        description: null,
      }),
    });
  });

  it("stocke les autres images et termine normalement même si l'upload d'une image échoue", async () => {
    const storage = fakeStorage({
      // 1er appel = l'upload du document lui-même (doit réussir) ; 2e = l'image en
      // échec ; 3e = l'image qui réussit.
      upload: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("panne de stockage"))
        .mockResolvedValueOnce(undefined),
    });
    describeImage.mockResolvedValue("Une description.");

    const images = [
      { position: 1, contentType: "image/png", buffer: Buffer.from("échec") },
      { position: 2, contentType: "image/png", buffer: Buffer.from("succès") },
    ];

    const result = await ingestDocumentVersion(baseInput({ extractedImages: images }), {
      storage,
      llm: noopLlm,
    });

    // Le dépôt du document se termine normalement — aucune promesse rejetée
    // n'a remonté jusqu'à l'appelant.
    expect(result.documentVersionId).toBe("dv-1");
    // Seule l'image qui a réussi son upload est enregistrée en base.
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 2, description: "Une description." }),
    });
  });

  it("termine normalement même si l'enregistrement en base d'une image échoue", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("Une description.");
    prismaMock.documentVersionImage.create.mockRejectedValue(new Error("contrainte violée"));

    const image = { position: 1, contentType: "image/png", buffer: Buffer.from("x") };

    await expect(
      ingestDocumentVersion(baseInput({ extractedImages: [image] }), { storage, llm: noopLlm })
    ).resolves.toMatchObject({ documentVersionId: "dv-1" });
  });

  it("n'appelle ni le stockage ni la description quand aucune image n'a été extraite", async () => {
    const storage = fakeStorage();

    await ingestDocumentVersion(baseInput({ extractedImages: [] }), { storage, llm: noopLlm });

    expect(storage.upload).toHaveBeenCalledTimes(1); // seulement le fichier lui-même
    expect(describeImage).not.toHaveBeenCalled();
    expect(prismaMock.documentVersionImage.create).not.toHaveBeenCalled();
  });

  // Décision Damon (revue finale, 16/09/2026) : la description générée par le
  // modèle de vision échappait à l'anonymisation appliquée partout ailleurs dans
  // le dépôt avant tout envoi/stockage destiné à un prompt (D5).
  it("anonymise la description d'image avant de la stocker", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("Contact visible sur l'affiche : sandrine@eoda-conseil.fr");

    const image = { position: 1, contentType: "image/png", buffer: Buffer.from("x") };
    await ingestDocumentVersion(baseInput({ extractedImages: [image] }), { storage, llm: noopLlm });

    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "Contact visible sur l'affiche : [email masqué]",
      }),
    });
  });

  // Plafonds décidés par Damon : sans borne, un seul dépôt pouvait déclencher un
  // fan-out non borné d'appels payants à OpenRouter en parallèle.
  it("ignore silencieusement les images au-delà du plafond, par ordre de position", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("description");

    const images = Array.from({ length: MAX_IMAGES_DESCRIBED + 1 }, (_, i) => ({
      position: i + 1,
      contentType: "image/png",
      buffer: Buffer.from("x"),
    }));

    await ingestDocumentVersion(baseInput({ extractedImages: images }), { storage, llm: noopLlm });

    // Un upload pour le fichier lui-même + un par image retenue (le plafond, pas
    // le plafond + 1).
    expect(storage.upload).toHaveBeenCalledTimes(1 + MAX_IMAGES_DESCRIBED);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledTimes(MAX_IMAGES_DESCRIBED);
    // La dernière image (position MAX_IMAGES_DESCRIBED + 1) n'a jamais été traitée.
    expect(prismaMock.documentVersionImage.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ position: MAX_IMAGES_DESCRIBED + 1 }) })
    );
  });

  it("ignore silencieusement une image dépassant la taille maximale, sans l'uploader ni la décrire", async () => {
    const storage = fakeStorage();
    describeImage.mockResolvedValue("description");

    const tooLarge = {
      position: 1,
      contentType: "image/png",
      buffer: Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1),
    };
    const ok = { position: 2, contentType: "image/png", buffer: Buffer.from("x") };

    await ingestDocumentVersion(baseInput({ extractedImages: [tooLarge, ok] }), { storage, llm: noopLlm });

    // Un upload pour le fichier lui-même + un seul pour l'image de taille correcte.
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(describeImage).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.documentVersionImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ position: 2 }),
    });
  });
});
