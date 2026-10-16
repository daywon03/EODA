import { beforeEach, describe, expect, it, vi } from "vitest";

// « Marquer relu » (setAnalysisReviewed) — test de bout en bout du 12/10 : une
// analyse ILLISIBLE (appel interrompu, adaptateur de repli, JSON vide) pouvait être
// marquée relue. La structure lisait alors « Relu par EODA » sur une analyse qui ne
// disait rien. Le serveur refuse désormais, avec la même lecture que l'écran
// (parseAnalysisResult) — pas une seconde règle.

const prismaMock = {
  documentVersion: { findUnique: vi.fn(), update: vi.fn() },
};

const requireEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();
const notFoundError = new Error("NEXT_NOT_FOUND");

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw notFoundError;
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
  tryEstablishmentAccess: vi.fn(),
  requireEstablishmentInTenant: vi.fn(),
}));
vi.mock("@/lib/services/text-extraction-service", () => ({ extractMarkdown: vi.fn() }));
vi.mock("@/lib/services/document-categorization-service", () => ({ suggestDocumentType: vi.fn() }));
vi.mock("@/lib/services/document-ingestion-service", () => ({
  ingestDocumentVersion: vi.fn(),
  reanalyzeDocumentVersion: vi.fn(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/upload-validation-service", () => ({ validateUploadedFile: vi.fn() }));
vi.mock("@/lib/services/establishment-offer-service", () => ({
  getEstablishmentCoveredCategories: vi.fn(),
  isCategoryCoveredForEstablishment: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({}) }));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}), isKnownLlmModelId: () => false }));

const { setAnalysisReviewed } = await import("./document");

const READABLE = {
  elementsPresents: [{ text: "Les horaires d'ouverture figurent en page 2.", source: null }],
  elementsManquants: ["Modalités de recours au médiateur."],
  suggestionsCorrection: [],
  sembleConforme: false,
};

function givenVersion(analysisResultJson: unknown): void {
  prismaMock.documentVersion.findUnique.mockResolvedValue({
    id: "v1",
    analysisResultJson,
    analysisReviewedAt: null,
    document: { establishmentId: "etab-1" },
  });
}

describe("setAnalysisReviewed — analyse illisible", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireEstablishmentAccess.mockResolvedValue({
      isClient: false,
      userId: "u-cabinet",
      session: { user: { role: "CABINET_ADMIN" } },
    });
  });

  it("refuse de marquer relue une analyse qui ne contient aucun constat", async () => {
    givenVersion({ elementsPresents: [], elementsManquants: [], suggestionsCorrection: [] });

    const result = await setAnalysisReviewed("v1", true);

    expect(result).toEqual({ error: expect.stringMatching(/relancer l'analyse d'abord/i) });
    expect(prismaMock.documentVersion.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refuse aussi un JSON qui n'a pas la forme d'une analyse", async () => {
    givenVersion("réponse tronquée");

    const result = await setAnalysisReviewed("v1", true);

    expect(result).toEqual({ error: expect.stringMatching(/relancer l'analyse d'abord/i) });
    expect(prismaMock.documentVersion.update).not.toHaveBeenCalled();
  });

  it("accepte une analyse lisible (cas nominal) et journalise", async () => {
    givenVersion(READABLE);

    const result = await setAnalysisReviewed("v1", true);

    expect(result).toBeNull();
    expect(prismaMock.documentVersion.update).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ANALYSIS_PUBLISHED" }));
  });

  it("laisse retirer la mention « relu » même si l'analyse est illisible", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue({
      id: "v1",
      analysisResultJson: {},
      analysisReviewedAt: new Date("2026-10-12T10:00:00Z"),
      document: { establishmentId: "etab-1" },
    });

    const result = await setAnalysisReviewed("v1", false);

    expect(result).toBeNull();
    expect(prismaMock.documentVersion.update).toHaveBeenCalledTimes(1);
  });

  it("refuse un compte client (introuvable, rien n'est révélé)", async () => {
    givenVersion(READABLE);
    requireEstablishmentAccess.mockResolvedValue({ isClient: true, userId: "u-client", session: { user: { role: "CLIENT_USER" } } });

    await expect(setAnalysisReviewed("v1", true)).rejects.toBe(notFoundError);
    expect(prismaMock.documentVersion.update).not.toHaveBeenCalled();
  });

  it("introuvable : version inexistante", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(null);

    await expect(setAnalysisReviewed("absent", true)).rejects.toBe(notFoundError);
  });
});
