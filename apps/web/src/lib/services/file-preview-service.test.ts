import { beforeEach, describe, expect, it, vi } from "vitest";

// Corrige le retour du 15/09/2026 : « Voir » affichait le texte brut extrait par
// l'IA à la place du document d'origine pour tout ce qui n'était pas un PDF — y
// compris une image déposée telle quelle. Ce test verrouille les trois branches :
// PDF et image passent par une URL signée, le reste retombe sur le Markdown déjà
// extrait (jamais le texte brut nu, cf. FilePreviewModal).

const getSignedDownloadUrl = vi.fn();

vi.mock("@/lib/storage", () => ({
  getFileStoragePort: () => ({ getSignedDownloadUrl }),
}));

const { buildFilePreview, isImageFile } = await import("./file-preview-service");

beforeEach(() => {
  vi.clearAllMocks();
  getSignedDownloadUrl.mockResolvedValue("https://storage.example/signed-url");
});

describe("buildFilePreview", () => {
  it("rend un PDF via une URL signée", async () => {
    const result = await buildFilePreview({
      originalFilename: "rapport.pdf",
      fileStorageKey: "key-1",
      extractedText: "# Rapport",
    });

    expect(result).toEqual({
      kind: "pdf",
      url: "https://storage.example/signed-url",
      filename: "rapport.pdf",
    });
  });

  it("rend une image (.jpg/.png) via une URL signée, jamais en texte", async () => {
    const result = await buildFilePreview({
      originalFilename: "charte.jpg",
      fileStorageKey: "key-2",
      extractedText: null,
    });

    expect(result).toEqual({
      kind: "image",
      url: "https://storage.example/signed-url",
      filename: "charte.jpg",
    });
  });

  it("rend un .docx en Markdown formaté, pas en texte brut", async () => {
    const result = await buildFilePreview({
      originalFilename: "projet-de-service.docx",
      fileStorageKey: "key-3",
      extractedText: "# Projet de service\n\nContenu.",
    });

    expect(result).toEqual({
      kind: "markdown",
      text: "# Projet de service\n\nContenu.",
      filename: "projet-de-service.docx",
    });
  });

  it("indique l'aperçu indisponible sans texte extrait ni format natif", async () => {
    const result = await buildFilePreview({
      originalFilename: "ancien.doc",
      fileStorageKey: "key-4",
      extractedText: null,
    });

    expect(result).toEqual({ kind: "unavailable", filename: "ancien.doc" });
  });
});

describe("isImageFile", () => {
  it("reconnaît jpg, jpeg et png, insensible à la casse", () => {
    expect(isImageFile("photo.jpg")).toBe(true);
    expect(isImageFile("PHOTO.JPEG")).toBe(true);
    expect(isImageFile("scan.png")).toBe(true);
  });

  it("refuse les autres formats", () => {
    expect(isImageFile("document.docx")).toBe(false);
    expect(isImageFile("rapport.pdf")).toBe(false);
  });
});
