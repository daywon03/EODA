import { beforeEach, describe, expect, it, vi } from "vitest";

// Corrige le retour du 15/09/2026 : « Voir » affichait le texte brut extrait par
// l'IA à la place du document d'origine pour tout ce qui n'était pas un PDF — y
// compris une image déposée telle quelle.
//
// Second verrou, du 16/10/2026 : un `.docx` s'affichait en MARKDOWN — un texte, pas un
// document. L'ordre des branches est donc le sujet de ce test : quand une adresse de
// pages est fournie, elle passe AVANT le texte extrait, sans quoi un `.docx` continuerait
// d'afficher du Markdown alors que ses pages sont disponibles. C'est exactement le bug
// que ce fichier doit empêcher de revenir.

const getSignedDownloadUrl = vi.fn();

vi.mock("@/lib/storage", () => ({
  getFileStoragePort: () => ({ getSignedDownloadUrl }),
}));

const { buildFilePreview } = await import("./file-preview-service");

const PAGES_URL = "/api/documents/version-1/pdf";

beforeEach(() => {
  vi.clearAllMocks();
  getSignedDownloadUrl.mockResolvedValue("https://storage.example/signed-url");
});

describe("buildFilePreview", () => {
  it("rend un PDF via une URL signée, même si des pages pourraient être produites", async () => {
    const result = await buildFilePreview({
      originalFilename: "rapport.pdf",
      fileStorageKey: "key-1",
      extractedText: "# Rapport",
      documentPagesUrl: PAGES_URL,
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
      documentPagesUrl: PAGES_URL,
    });

    expect(result).toEqual({
      kind: "image",
      url: "https://storage.example/signed-url",
      filename: "charte.jpg",
    });
  });

  it("rend un .docx en PAGES, avant le Markdown extrait", async () => {
    const result = await buildFilePreview({
      originalFilename: "projet-de-service.docx",
      fileStorageKey: "key-3",
      extractedText: "# Projet de service\n\nContenu.",
      documentPagesUrl: PAGES_URL,
    });

    expect(result).toEqual({
      kind: "document",
      url: PAGES_URL,
      filename: "projet-de-service.docx",
    });
  });

  it("sans adresse de pages, un .docx retombe sur son Markdown extrait", async () => {
    const result = await buildFilePreview({
      originalFilename: "projet-de-service.docx",
      fileStorageKey: "key-4",
      extractedText: "# Projet de service\n\nContenu.",
      documentPagesUrl: null,
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
      fileStorageKey: "key-5",
      extractedText: null,
      documentPagesUrl: null,
    });

    expect(result).toEqual({ kind: "unavailable", filename: "ancien.doc" });
  });
});

// `isImageFile` a son propre fichier de test, à côté de son implémentation
// (file-type-service.test.ts) : elle y a été déplacée pour être importable depuis un
// composant client sans tirer l'adaptateur de stockage dans le bundle navigateur.
