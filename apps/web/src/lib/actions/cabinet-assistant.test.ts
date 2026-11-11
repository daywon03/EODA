import { beforeEach, describe, expect, it, vi } from "vitest";

// Assistant du menu latéral (11/11/2026). Cabinet seulement ; fil de l'auteur seulement ;
// crédits partagés ; cartes revérifiées et rejouées par l'action réelle ; journal sans
// la question.

const prismaMock = {
  assistantConversation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  assistantMessage: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  establishmentDocumentDesign: { findUnique: vi.fn() },
};
const requireCabinetSession = vi.fn();
const requireEstablishmentInTenant = vi.fn();
const recordAuditEvent = vi.fn();
const runCabinetAgent = vi.fn();
const creditsUsedToday = vi.fn();
const debitCredits = vi.fn();
const addDocumentComment = vi.fn();
const requestInformationFromStructure = vi.fn();
const saveDocumentDesignNotes = vi.fn();
const getAssistantChatPort = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: (need: string) => requireCabinetSession(need),
  requireEstablishmentInTenant: (id: string, mode: string) => requireEstablishmentInTenant(id, mode),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock("@/lib/services/cabinet-assistant-agent", () => ({ runCabinetAgent: (...a: unknown[]) => runCabinetAgent(...a) }));
vi.mock("@/lib/db/cabinet-assistant-deps", () => ({ cabinetAssistantDeps: () => ({}) }));
vi.mock("@/lib/db/assistant-credits", () => ({
  creditsUsedToday: (...a: unknown[]) => creditsUsedToday(...a),
  debitCredits: (...a: unknown[]) => debitCredits(...a),
}));
vi.mock("@/lib/llm/assistant-chat", () => {
  class AssistantChatError extends Error {
    constructor(
      message: string,
      readonly cost: number | null = null
    ) {
      super(message);
    }
  }
  return { AssistantChatError, getAssistantChatPort: () => getAssistantChatPort() };
});
vi.mock("./document-comment", () => ({ addDocumentComment: (...a: unknown[]) => addDocumentComment(...a) }));
vi.mock("./information-request", () => ({ requestInformationFromStructure: (f: FormData) => requestInformationFromStructure(f) }));
vi.mock("./document-design", () => ({ saveDocumentDesignNotes: (...a: unknown[]) => saveDocumentDesignNotes(...a) }));

const { askCabinetAssistant, getCabinetAssistant, resolveCabinetAssistantProposal, deleteCabinetAssistantConversation } = await import(
  "./cabinet-assistant"
);

const MENU = { userId: "u-eval", establishmentId: null, documentTypeId: null };
const proposal = (kind: string, extra: Record<string, unknown> = {}) => ({
  kind,
  text: "Texte proposé",
  status: "PENDING",
  establishmentId: "etab-1",
  establishmentName: "SAD Les Glycines (fictif)",
  documentTypeId: "dt-1",
  documentLabel: "Plan de crise",
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetSession.mockResolvedValue({ userId: "u-eval", tenantId: "t-1", session: { user: { role: "CABINET_EVALUATOR", name: "Consultante" } } });
  requireEstablishmentInTenant.mockResolvedValue({ establishmentId: "etab-1" });
  creditsUsedToday.mockResolvedValue(3);
  getAssistantChatPort.mockReturnValue({ step: vi.fn() });
  prismaMock.assistantConversation.create.mockResolvedValue({ id: "conv-1" });
  prismaMock.assistantConversation.findMany.mockResolvedValue([]);
  prismaMock.assistantMessage.findMany.mockResolvedValue([]);
  runCabinetAgent.mockResolvedValue({
    text: "Deux documents sont à relire.",
    proposals: [proposal("INFORMATION_REQUEST")],
    cost: 0.004,
    inputTokens: 900,
    outputTokens: 80,
    model: "minimax/minimax-m2.7",
    toolsUsed: ["list_structures", "get_structure_documents"],
  });
});

describe("askCabinetAssistant", () => {
  it("répond par l'agent, garde les cartes, décompte le coût réel, journalise sans la question", async () => {
    expect(await askCabinetAssistant(null, "Où en sont mes structures ?")).toEqual({ conversationId: "conv-1" });
    expect(requireCabinetSession).toHaveBeenCalledWith("STRUCTURES_WRITE");
    expect(prismaMock.assistantConversation.create).toHaveBeenCalledWith({ data: { userId: "u-eval", title: "Où en sont mes structures ?" }, select: { id: true } });
    expect(prismaMock.assistantMessage.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ role: "ASSISTANT", credits: 3, proposalsJson: [proposal("INFORMATION_REQUEST")] }),
    });
    expect(debitCredits).toHaveBeenCalledWith("u-eval", 3, 900, 80);
    const audit = recordAuditEvent.mock.calls[0]?.[0] as { detail: string };
    expect(audit.detail).toBe("assistant du cabinet · 3 crédits · outils : list_structures, get_structure_documents");
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("Où en sont");
  });

  it("compte sans droit d'écriture ou client : refusé avant tout", async () => {
    requireCabinetSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(askCabinetAssistant(null, "q")).rejects.toThrow("REDIRECT");
    expect(runCabinetAgent).not.toHaveBeenCalled();
  });

  it("crédits épuisés : aucun appel", async () => {
    creditsUsedToday.mockResolvedValue(40);
    expect(await askCabinetAssistant(null, "q")).toMatchObject({ error: expect.stringContaining("minuit") });
    expect(runCabinetAgent).not.toHaveBeenCalled();
  });

  it("fil d'un autre compte ou d'un document : notFound", async () => {
    prismaMock.assistantConversation.findFirst.mockResolvedValue(null);
    await expect(askCabinetAssistant("conv-autre", "q")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.assistantConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "conv-autre", ...MENU } }));
  });
});

describe("getCabinetAssistant", () => {
  it("lecture seule : les fils du menu de l'appelant", async () => {
    await getCabinetAssistant();
    expect(requireCabinetSession).toHaveBeenCalledWith("STRUCTURES_READ");
    expect(prismaMock.assistantConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: MENU }));
  });
});

describe("resolveCabinetAssistantProposal", () => {
  it("demande à la structure : rejouée par requestInformationFromStructure avec ses identifiants", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue({ id: "m-1", proposalsJson: [proposal("INFORMATION_REQUEST")] });
    requestInformationFromStructure.mockResolvedValue({ ok: true, notified: 1 });
    expect(await resolveCabinetAssistantProposal("m-1", 0, "CONFIRM")).toBeNull();
    const form = requestInformationFromStructure.mock.calls[0]?.[0] as FormData;
    expect([form.get("establishmentId"), form.get("documentTypeId"), form.get("title")]).toEqual(["etab-1", "dt-1", "Texte proposé"]);
    expect(prismaMock.assistantMessage.update).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { proposalsJson: [proposal("INFORMATION_REQUEST", { status: "APPLIED" })] },
    });
  });

  it("consigne pour l'IA : rejouée par addDocumentComment", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue({ id: "m-1", proposalsJson: [proposal("COMMENT")] });
    addDocumentComment.mockResolvedValue(null);
    expect(await resolveCabinetAssistantProposal("m-1", 0, "CONFIRM")).toBeNull();
    expect(addDocumentComment).toHaveBeenCalledWith("etab-1", "dt-1", "Texte proposé", true);
  });

  it("mise en page : garde de la structure AVANT de lire, consignes ajoutées sans écraser", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue({ id: "m-1", proposalsJson: [proposal("DESIGN_NOTES", { documentTypeId: null })] });
    prismaMock.establishmentDocumentDesign.findUnique.mockResolvedValue({ notes: "Titres en majuscules" });
    saveDocumentDesignNotes.mockResolvedValue(null);
    expect(await resolveCabinetAssistantProposal("m-1", 0, "CONFIRM")).toBeNull();
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "WRITE");
    expect(saveDocumentDesignNotes).toHaveBeenCalledWith("etab-1", "Titres en majuscules\nTexte proposé");
  });

  it("structure hors périmètre au clic : la garde refuse, rien n'est écrit", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue({ id: "m-1", proposalsJson: [proposal("DESIGN_NOTES", { establishmentId: "etab-autre", documentTypeId: null })] });
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(resolveCabinetAssistantProposal("m-1", 0, "CONFIRM")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.establishmentDocumentDesign.findUnique).not.toHaveBeenCalled();
    expect(saveDocumentDesignNotes).not.toHaveBeenCalled();
  });

  it("message d'un autre compte : notFound ; carte déjà traitée : refusée", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue(null);
    await expect(resolveCabinetAssistantProposal("m-x", 0, "CONFIRM")).rejects.toThrow("NOT_FOUND");
    prismaMock.assistantMessage.findFirst.mockResolvedValue({ id: "m-1", proposalsJson: [proposal("COMMENT", { status: "APPLIED" })] });
    expect(await resolveCabinetAssistantProposal("m-1", 0, "CONFIRM")).toMatchObject({ error: expect.stringContaining("déjà") });
    expect(addDocumentComment).not.toHaveBeenCalled();
  });
});

describe("deleteCabinetAssistantConversation", () => {
  it("seulement un fil de l'appelant", async () => {
    prismaMock.assistantConversation.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteCabinetAssistantConversation("conv-autre")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.assistantConversation.deleteMany).toHaveBeenCalledWith({ where: { id: "conv-autre", ...MENU } });
  });
});
