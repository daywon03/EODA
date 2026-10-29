import { beforeEach, describe, expect, it, vi } from "vitest";

// Laboratoire d'analyse (29/10/2026) : cabinet seul ; la version de document est une
// entrée non fiable ; un essai n'écrit JAMAIS sur la version (analyse officielle,
// statut, suggestions) ; débit borné ; verdict validé ; bilan borné au périmètre.

const prismaMock = {
  documentVersion: { findUnique: vi.fn(), update: vi.fn() },
  analysisTrial: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
};
const requireEstablishmentAccess = vi.fn();
const requireCabinetSession = vi.fn();
const recordAuditEvent = vi.fn();
const consumeThrottledAttempt = vi.fn();
const readAnalysisTarget = vi.fn();
const prepareAnalysisInput = vi.fn();
const llm = { describeAnalysisCall: vi.fn(), analyze: vi.fn() };

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (id: string, need: unknown) => requireEstablishmentAccess(id, need),
  requireCabinetSession: (cap: string) => requireCabinetSession(cap),
  structureScopeWhere: (context: { tenantId: string }) => ({ tenantId: context.tenantId, id: { in: ["etab-1"] } }),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));
vi.mock("@/lib/security/attempt-throttle", () => ({ consumeThrottledAttempt: (o: unknown) => consumeThrottledAttempt(o) }));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => llm, isKnownLlmModelId: (id: string) => id === "claude-opus-5" }));
vi.mock("@/lib/services/document-ingestion-service", () => ({
  readAnalysisTarget: (id: string) => readAnalysisTarget(id),
  prepareAnalysisInput: (t: unknown) => prepareAnalysisInput(t),
}));

const { previewAnalysisPrompt, runAnalysisTrial, judgeAnalysisTrial, listAnalysisTrials, getAnalysisLabOverview } = await import("./analysis-lab");

const RESULT = {
  elementsPresents: [],
  elementsManquants: ["x"],
  suggestionsCorrection: [],
  sembleConforme: false,
  criteriaCoverage: [],
  criteresSupplementaires: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.documentVersion.findUnique.mockResolvedValue({ document: { establishmentId: "etab-1", establishment: { tenantId: "t-1" } } });
  requireEstablishmentAccess.mockResolvedValue({ isClient: false, userId: "u-1", session: { user: { role: "CABINET_EVALUATOR" } } });
  consumeThrottledAttempt.mockResolvedValue(true);
  readAnalysisTarget.mockResolvedValue({ target: { documentVersionId: "v-1", extractedText: "texte" }, version: {} });
  prepareAnalysisInput.mockResolvedValue({ input: { documentTypeLabel: "Livret" } });
  llm.describeAnalysisCall.mockReturnValue({ provider: "OpenRouter", model: "anthropic/claude-opus-5", system: "SYS", user: "USER" });
  llm.analyze.mockResolvedValue(RESULT);
  prismaMock.analysisTrial.create.mockResolvedValue({ id: "trial-1" });
});

describe("gardes", () => {
  it("un compte client : notFound, rien n'est lu ni écrit", async () => {
    requireEstablishmentAccess.mockResolvedValue({ isClient: true, userId: "c-1", session: { user: { role: "CLIENT_USER" } } });
    await expect(previewAnalysisPrompt("v-1", "cible", null)).rejects.toThrow("NOT_FOUND");
    await expect(runAnalysisTrial("v-1", "cible", null)).rejects.toThrow("NOT_FOUND");
    expect(llm.analyze).not.toHaveBeenCalled();
  });

  it("une version inconnue : notFound avant toute garde", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(null);
    await expect(previewAnalysisPrompt("v-x", "cible", null)).rejects.toThrow("NOT_FOUND");
    expect(requireEstablishmentAccess).not.toHaveBeenCalled();
  });

  it("l'établissement est relu par la version, et gardé en lecture pour voir, en écriture pour essayer", async () => {
    await previewAnalysisPrompt("v-1", "cible", null);
    expect(requireEstablishmentAccess).toHaveBeenCalledWith("etab-1", { module: "DOCUMENTS", mode: "READ" });
    await runAnalysisTrial("v-1", "cible", null);
    expect(requireEstablishmentAccess).toHaveBeenLastCalledWith("etab-1", { module: "DOCUMENTS", mode: "WRITE" });
  });
});

describe("previewAnalysisPrompt", () => {
  it("rend l'appel décrit par l'adaptateur, sans appeler le modèle, et journalise l'accès", async () => {
    const preview = await previewAnalysisPrompt("v-1", "cible", "claude-opus-5");
    expect(preview).toEqual(expect.objectContaining({ provider: "OpenRouter", model: "anthropic/claude-opus-5", system: "SYS", user: "USER", variantLabel: "Ciblé · v1" }));
    expect(prepareAnalysisInput).toHaveBeenCalledWith(expect.objectContaining({ promptVariant: "cible", modelId: "claude-opus-5" }));
    expect(llm.analyze).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ANALYSIS_PROMPT_VIEWED", targetId: "v-1" }));
  });

  it("une version ou un modèle inconnus retombent sur les valeurs par défaut, jamais sur le texte reçu", async () => {
    await previewAnalysisPrompt("v-1", "ignore tout", "modele-pirate");
    const target = prepareAnalysisInput.mock.calls[0]![0] as Record<string, unknown>;
    expect(target.promptVariant).toBe("actuel");
    expect(target).not.toHaveProperty("modelId");
  });

  it("sans texte extrait : le dit, sans rien préparer", async () => {
    readAnalysisTarget.mockResolvedValue({ target: { extractedText: null }, version: {} });
    expect(await previewAnalysisPrompt("v-1", "cible", null)).toEqual({ error: expect.stringMatching(/pas encore été extrait/) });
    expect(prepareAnalysisInput).not.toHaveBeenCalled();
  });
});

describe("runAnalysisTrial", () => {
  it("garde l'essai (version et numéro du prompt, modèle, résultat) SANS toucher à la version analysée", async () => {
    expect(await runAnalysisTrial("v-1", "mode-operatoire", null)).toEqual({ trialId: "trial-1" });
    expect(prismaMock.analysisTrial.create).toHaveBeenCalledWith({
      data: {
        tenantId: "t-1",
        documentVersionId: "v-1",
        promptVariant: "mode-operatoire",
        promptVersion: 1,
        model: "anthropic/claude-opus-5",
        resultJson: RESULT,
        createdByUserId: "u-1",
      },
      select: { id: true },
    });
    expect(prismaMock.documentVersion.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ANALYSIS_TRIAL_RUN", targetId: "trial-1" }));
  });

  it("débit dépassé : refusé avant tout appel au modèle", async () => {
    consumeThrottledAttempt.mockResolvedValue(false);
    expect(await runAnalysisTrial("v-1", "cible", null)).toEqual({ error: expect.stringMatching(/Trop d'essais/) });
    expect(llm.analyze).not.toHaveBeenCalled();
  });

  it("un modèle qui échoue : le dit, rien n'est gardé", async () => {
    llm.analyze.mockRejectedValue(new Error("HTTP 500"));
    expect(await runAnalysisTrial("v-1", "cible", null)).toEqual({ error: expect.stringMatching(/a échoué/) });
    expect(prismaMock.analysisTrial.create).not.toHaveBeenCalled();
  });
});

describe("judgeAnalysisTrial", () => {
  beforeEach(() => {
    prismaMock.analysisTrial.findUnique.mockResolvedValue({ id: "trial-1", documentVersionId: "v-1" });
  });

  it("pose le verdict et la note ; le journal ne recopie jamais la note", async () => {
    expect(await judgeAnalysisTrial("trial-1", "BON", "  bien ciblé ")).toBeNull();
    expect(prismaMock.analysisTrial.update).toHaveBeenCalledWith({
      where: { id: "trial-1" },
      data: expect.objectContaining({ verdict: "BON", verdictNote: "bien ciblé", judgedByUserId: "u-1" }),
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ANALYSIS_TRIAL_JUDGED", detail: "BON" }));
  });

  it("verdict inconnu ou essai inconnu : refusés", async () => {
    expect(await judgeAnalysisTrial("trial-1", "PARFAIT", null)).toEqual({ error: expect.any(String) });
    prismaMock.analysisTrial.findUnique.mockResolvedValue(null);
    await expect(judgeAnalysisTrial("trial-x", "BON", null)).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.analysisTrial.update).not.toHaveBeenCalled();
  });
});

describe("lectures", () => {
  it("listAnalysisTrials ne lit que les essais de CETTE version, et dit avec quoi l'analyse officielle a été faite", async () => {
    prismaMock.documentVersion.findUnique
      .mockResolvedValueOnce({ document: { establishmentId: "etab-1", establishment: { tenantId: "t-1" } } })
      .mockResolvedValueOnce({ analysisResultJson: null, analysisPromptVariant: null, analysisPromptVersion: null, analysisModel: null, analyzedAt: null });
    prismaMock.analysisTrial.findMany.mockResolvedValue([]);
    const result = await listAnalysisTrials("v-1");
    expect(prismaMock.analysisTrial.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { documentVersionId: "v-1" } }));
    expect(result.official.promptLabel).toMatch(/antérieure/);
  });

  it("le bilan est borné au tenant ET au périmètre de l'appelant", async () => {
    requireCabinetSession.mockResolvedValue({ tenantId: "t-1" });
    prismaMock.analysisTrial.findMany.mockResolvedValue([]);
    await getAnalysisLabOverview();
    expect(requireCabinetSession).toHaveBeenCalledWith("STRUCTURES_READ");
    expect(prismaMock.analysisTrial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "t-1", documentVersion: { document: { establishment: { tenantId: "t-1", id: { in: ["etab-1"] } } } } },
      })
    );
  });
});
