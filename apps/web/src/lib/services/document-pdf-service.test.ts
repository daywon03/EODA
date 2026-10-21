import { beforeEach, describe, expect, it, vi } from "vitest";

// Le service orchestre trois choses : lire un cache, convertir, rendre. Ce que ce test
// fixe, c'est l'ordre et les cas limites — parce que ce sont eux qui coûtent cher en
// production : un cache servi sur un objet tronqué, ou un rendu reperdu parce qu'une
// écriture de cache a échoué.

const download = vi.fn();
const upload = vi.fn();
const remove = vi.fn();
const buildDocumentBody = vi.fn();
const renderHtmlToPdf = vi.fn();

vi.mock("@/lib/storage", () => ({
  getFileStoragePort: () => ({ download, upload, delete: remove }),
}));

vi.mock("@/lib/services/document-pdf-render-service", () => ({
  buildDocumentBody,
  renderHtmlToPdf,
}));

const { getOrRenderDocumentPdf } = await import("./document-pdf-service");
const { documentPdfCacheKey, deleteCachedDocumentPdf } = await import("./document-pdf-cache");

const SOURCE = {
  versionId: "version-1",
  originalFilename: "projet-de-service.docx",
  fileStorageKey: "etab/type/v1-projet-de-service.docx",
  title: "Projet de service",
  subtitle: "Version 1 · projet-de-service.docx",
};

const PDF_BYTES = Buffer.from("%PDF-1.7\n%contenu\n", "latin1");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  buildDocumentBody.mockResolvedValue({ bodyHtml: "<p>Corps</p>", notice: "Mention." });
  renderHtmlToPdf.mockResolvedValue(PDF_BYTES);
});

describe("documentPdfCacheKey", () => {
  it("range le rendu sous l'identifiant de version, qui est immuable", () => {
    // Une `DocumentVersion` désigne un fichier déposé une fois pour toutes : régénérer
    // une mise en conformité crée une NOUVELLE version, l'originale n'est jamais
    // réécrite. La clé ne peut donc pas servir un rendu périmé.
    expect(documentPdfCacheKey("abc")).toBe("renders/abc.pdf");
  });
});

describe("getOrRenderDocumentPdf", () => {
  it("sert le rendu en cache, sans convertir ni lancer Chromium", async () => {
    download.mockResolvedValue(PDF_BYTES);

    const pdf = await getOrRenderDocumentPdf(SOURCE);

    expect(pdf).toEqual(PDF_BYTES);
    expect(download).toHaveBeenCalledWith("renders/version-1.pdf");
    expect(buildDocumentBody).not.toHaveBeenCalled();
    expect(renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it("convertit et met en cache au premier aperçu", async () => {
    // Absence normale : le stockage refuse la lecture de la clé de cache.
    download.mockImplementation((key: string) =>
      key === SOURCE.fileStorageKey
        ? Promise.resolve(Buffer.from("octets-du-docx"))
        : Promise.reject(new Error("not found"))
    );

    const pdf = await getOrRenderDocumentPdf(SOURCE);

    expect(pdf).toEqual(PDF_BYTES);
    expect(buildDocumentBody).toHaveBeenCalledWith({
      originalFilename: "projet-de-service.docx",
      content: Buffer.from("octets-du-docx"),
    });
    expect(upload).toHaveBeenCalledWith("renders/version-1.pdf", PDF_BYTES, "application/pdf");
  });

  it("ne sert pas un objet rangé sous la clé qui n'est pas un PDF", async () => {
    // Un objet tronqué ou étranger ne doit pas partir comme un PDF : le contrôle coûte
    // cinq octets, le diagnostic d'un fichier corrompu coûte bien plus.
    download.mockImplementation((key: string) =>
      key === SOURCE.fileStorageKey
        ? Promise.resolve(Buffer.from("octets-du-docx"))
        : Promise.resolve(Buffer.from("<html>pas un pdf</html>"))
    );

    const pdf = await getOrRenderDocumentPdf(SOURCE);

    expect(pdf).toEqual(PDF_BYTES);
    expect(renderHtmlToPdf).toHaveBeenCalled();
  });

  it("rend `null` quand le format ne se convertit pas, sans rien écrire", async () => {
    download.mockImplementation((key: string) =>
      key === SOURCE.fileStorageKey
        ? Promise.resolve(Buffer.from("octets-dun-doc"))
        : Promise.reject(new Error("not found"))
    );
    buildDocumentBody.mockResolvedValue(null);

    const pdf = await getOrRenderDocumentPdf(SOURCE);

    expect(pdf).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("rend quand même le PDF si la mise en cache échoue", async () => {
    // Le cache est un CONFORT, jamais une condition : sans cela, un stockage qui refuse
    // une écriture rendrait l'aperçu indisponible alors que le PDF est déjà produit.
    download.mockImplementation((key: string) =>
      key === SOURCE.fileStorageKey
        ? Promise.resolve(Buffer.from("octets-du-docx"))
        : Promise.reject(new Error("not found"))
    );
    upload.mockRejectedValue(new Error("quota dépassé"));

    const pdf = await getOrRenderDocumentPdf(SOURCE);

    expect(pdf).toEqual(PDF_BYTES);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("deleteCachedDocumentPdf", () => {
  it("emporte le rendu avec la version supprimée", async () => {
    // Un PDF dérivé d'une pièce nominative ne survit pas à la pièce : c'est le même
    // engagement que la suppression du fichier d'origine.
    remove.mockResolvedValue(undefined);

    await deleteCachedDocumentPdf("version-1");

    expect(remove).toHaveBeenCalledWith("renders/version-1.pdf");
  });

  it("ne fait pas échouer la suppression de la version si le rendu est déjà absent", async () => {
    remove.mockRejectedValue(new Error("not found"));

    await expect(deleteCachedDocumentPdf("version-1")).resolves.toBeUndefined();
  });
});
