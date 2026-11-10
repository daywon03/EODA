import { beforeEach, describe, expect, it, vi } from "vitest";

// Les trois routes qui servent un document par son identifiant de version — pages
// (`/pdf`, y compris `?prepare=1`), original (`/original`), brouillon Word
// (`/draft-docx`) — face à un document à ACCÈS RESTREINT (le tampon, ADR 20261110) :
// aucun compte du cabinet, aucun autre rôle de la structure que la direction. Un refus
// est un `notFound()` et ne laisse aucune trace d'accès ; rien n'est lu au stockage.

const findUnique = vi.fn();
const tryEstablishmentAccess = vi.fn();
const download = vi.fn();
const recordAuditEvent = vi.fn();
const getOrRenderDocumentPdf = vi.fn();
const loadCorrectedDraftImages = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@eoda/database", () => ({ prisma: { documentVersion: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock("@/lib/auth/guards", () => ({ tryEstablishmentAccess: (...a: unknown[]) => tryEstablishmentAccess(...a) }));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({ download: (key: string) => download(key) }) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));
vi.mock("@/lib/services/document-pdf-service", () => ({ getOrRenderDocumentPdf: (a: unknown) => getOrRenderDocumentPdf(a) }));
vi.mock("@/lib/services/document-generation-service", () => ({
  loadCorrectedDraftImages: (...a: unknown[]) => loadCorrectedDraftImages(...a),
}));
vi.mock("@/lib/services/establishment-offer-service", () => ({ getEstablishmentSupportMode: async () => "ACCOMPAGNE" }));
vi.mock("@/lib/services/markdown-to-docx-service", () => ({ generateBrandedDocx: async () => Buffer.from("docx") }));

const pdfRoute = await import("./pdf/route");
const originalRoute = await import("./original/route");
const draftRoute = await import("./draft-docx/route");

const PDF = Buffer.from("%PDF-1.4 tampon");
const params = { params: Promise.resolve({ versionId: "v-t" }) };
const request = (query = "") => new Request(`https://x/api/documents/v-t/pdf${query}`);

function tampon(role = "CLIENT_USER") {
  return {
    id: "v-t",
    originalFilename: "tampon.pdf",
    fileStorageKey: "k-t",
    versionNumber: 1,
    correctedDraftMarkdown: "brouillon",
    uploadedBy: { role },
    document: {
      establishmentId: "etab-1",
      validatedAt: null,
      establishment: { name: "SAD fictif" },
      documentType: { code: "DEPARTEMENT_TAMPON", label: "Tampon de la structure" },
    },
  };
}
const asCabinet = () =>
  tryEstablishmentAccess.mockResolvedValue({ isClient: false, clientAccessRole: null, userId: "u-cab", session: { user: { role: "CABINET_ADMIN" } } });
const asClient = (clientAccessRole: string) =>
  tryEstablishmentAccess.mockResolvedValue({ isClient: true, clientAccessRole, userId: "u-1", session: { user: { role: "CLIENT_USER" } } });

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(tampon());
  download.mockResolvedValue(PDF);
  getOrRenderDocumentPdf.mockResolvedValue(PDF);
  loadCorrectedDraftImages.mockResolvedValue([]);
});

function expectNothingServed(): void {
  expect(download).not.toHaveBeenCalled();
  expect(getOrRenderDocumentPdf).not.toHaveBeenCalled();
  expect(loadCorrectedDraftImages).not.toHaveBeenCalled();
  expect(recordAuditEvent).not.toHaveBeenCalled();
}

describe("routes de document — tampon de la structure, refus", () => {
  it("le cabinet (administration comprise) : ni pages, ni préparation, ni original, ni brouillon", async () => {
    asCabinet();
    await expect(pdfRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
    await expect(pdfRoute.GET(request("?prepare=1"), params)).rejects.toThrow("NOT_FOUND");
    await expect(pdfRoute.GET(request("?download=1"), params)).rejects.toThrow("NOT_FOUND");
    await expect(originalRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
    await expect(draftRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
    expectNothingServed();
  });

  it.each(["RESPONSABLE_QUALITE", "ADMINISTRATIF"])("la structure au rôle %s : ni pages ni original", async (role) => {
    asClient(role);
    await expect(pdfRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
    await expect(originalRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
    expectNothingServed();
  });
});

describe("routes de document — tampon de la structure, la direction", () => {
  it("ouvre les pages et l'original, même déposés par EODA pour son compte ; chaque accès est journalisé sans personne", async () => {
    asClient("DIRECTION");
    findUnique.mockResolvedValue(tampon("CABINET_ADMIN"));

    const pages = await pdfRoute.GET(request(), params);
    expect(pages.status).toBe(200);
    const original = await originalRoute.GET(request(), params);
    expect(original.status).toBe(200);

    expect(recordAuditEvent).toHaveBeenCalledTimes(2);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_PREVIEWED", targetId: "v-t", detail: "DEPARTEMENT_TAMPON" })
    );
  });

  it("ne reçoit pas le brouillon corrigé : il n'existe que pour le cabinet", async () => {
    asClient("DIRECTION");
    await expect(draftRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
  });
});

describe("routes de document — document ordinaire, inchangé", () => {
  it("le cabinet ouvre les pages d'un livret", async () => {
    asCabinet();
    findUnique.mockResolvedValue({
      ...tampon("CABINET_ADMIN"),
      document: { ...tampon().document, documentType: { code: "L2002_LIVRET_ACCUEIL", label: "Livret d'accueil" } },
    });
    const pages = await pdfRoute.GET(request(), params);
    expect(pages.status).toBe(200);
  });

  it("la structure ne reçoit pas un brouillon d'EODA non validé", async () => {
    asClient("DIRECTION");
    findUnique.mockResolvedValue({
      ...tampon("CABINET_ADMIN"),
      document: { ...tampon().document, documentType: { code: "L2002_LIVRET_ACCUEIL", label: "Livret d'accueil" } },
    });
    await expect(pdfRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
    await expect(originalRoute.GET(request(), params)).rejects.toThrow("NOT_FOUND");
  });
});
