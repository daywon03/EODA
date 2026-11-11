import { beforeEach, describe, expect, it, vi } from "vitest";

// Assistant de la fiche document (lot F, 11/11/2026). Cabinet seulement, structure de
// son périmètre ; jamais un document restreint ; 40 crédits par jour ; une conversation
// n'est lue que par son auteur ; une carte se revérifie au clic et rejoue l'action
// réelle avec SA garde ; journal sans la question.

const prismaMock = {
  documentType: { findUnique: vi.fn() },
  document: { findUnique: vi.fn() },
  documentTypeCriterion: { findMany: vi.fn() },
  assistantCreditDay: { findUnique: vi.fn(), upsert: vi.fn() },
  assistantConversation: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  assistantMessage: { findMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};
const requireEstablishmentInTenant = vi.fn();
const recordAuditEvent = vi.fn();
const reply = vi.fn();
const getAssistantChatPort = vi.fn();
const addDocumentComment = vi.fn();
const requestInformationFromStructure = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (id: string, mode: string) => requireEstablishmentInTenant(id, mode),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock("@/lib/llm/assistant-chat", async () => {
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
vi.mock("./information-request", () => ({
  requestInformationFromStructure: (f: FormData) => requestInformationFromStructure(f),
}));

const { askDocumentAssistant, getDocumentAssistant, resolveAssistantProposal, deleteAssistantConversation } = await import(
  "./document-assistant"
);
const { AssistantChatError } = await import("@/lib/llm/assistant-chat");

const LINE = { id: "dt-pca", code: "QUALITE_PCA", label: "Plan de crise", archivedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({
    userId: "u-eval",
    tenantId: "t-1",
    session: { user: { role: "CABINET_EVALUATOR" } },
    establishmentId: "etab-1",
  });
  prismaMock.documentType.findUnique.mockResolvedValue(LINE);
  prismaMock.assistantCreditDay.findUnique.mockResolvedValue({ used: 5 });
  prismaMock.assistantConversation.create.mockResolvedValue({ id: "conv-1" });
  prismaMock.assistantConversation.findMany.mockResolvedValue([]);
  prismaMock.assistantMessage.findMany.mockResolvedValue([]);
  prismaMock.document.findUnique.mockResolvedValue({
    missingJustification: null,
    commentUsedByAi: true,
    comments: [],
    currentVersion: { extractedText: "Texte du plan.", analysisResultJson: null },
  });
  prismaMock.documentTypeCriterion.findMany.mockResolvedValue([{ criterion: { code: "3.14.2", label: "Crise" } }]);
  getAssistantChatPort.mockReturnValue({ reply });
  reply.mockResolvedValue({
    text: JSON.stringify({ reponse: "Le DAC 93 manque.", propositions: [{ type: "demande_structure", texte: "Coordonnées du DAC 93 ?" }] }),
    cost: 0.004,
    inputTokens: 900,
    outputTokens: 60,
    model: "minimax/minimax-m2.7",
    truncated: false,
  });
});

describe("askDocumentAssistant", () => {
  it("répond, garde la carte en attente, décompte le coût réel, journalise sans la question", async () => {
    expect(await askDocumentAssistant("etab-1", "dt-pca", null, "Que manque-t-il ?")).toEqual({ conversationId: "conv-1" });
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "WRITE");
    const messages = reply.mock.calls[0]?.[0] as { role: string; content: string }[];
    expect(messages[1]?.content).toContain("<document_texte>");
    expect(messages.at(-1)).toEqual({ role: "user", content: "Que manque-t-il ?" });
    expect(prismaMock.assistantMessage.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        role: "ASSISTANT",
        content: "Le DAC 93 manque.",
        proposalsJson: [{ kind: "INFORMATION_REQUEST", text: "Coordonnées du DAC 93 ?", status: "PENDING" }],
        credits: 3,
      }),
    });
    expect(prismaMock.assistantCreditDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ used: { increment: 3 } }) })
    );
    const audit = recordAuditEvent.mock.calls[0]?.[0] as { detail: string };
    expect(audit.detail).toBe("QUALITE_PCA · 3 crédits");
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("Que manque");
  });

  it("compte du cabinet sans droit, structure hors périmètre : refusé avant toute lecture", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(askDocumentAssistant("autre", "dt-pca", null, "q")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.documentType.findUnique).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it("document à accès restreint : rien n'est envoyé au modèle", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue({ ...LINE, code: "DEPARTEMENT_TAMPON" });
    expect(await askDocumentAssistant("etab-1", "dt-pca", null, "q")).toMatchObject({ error: expect.stringContaining("restreint") });
    expect(reply).not.toHaveBeenCalled();
  });

  it("crédits du jour épuisés : refus, aucun appel", async () => {
    prismaMock.assistantCreditDay.findUnique.mockResolvedValue({ used: 40 });
    expect(await askDocumentAssistant("etab-1", "dt-pca", null, "q")).toMatchObject({ error: expect.stringContaining("minuit") });
    expect(reply).not.toHaveBeenCalled();
  });

  it("conversation d'un autre compte : notFound", async () => {
    prismaMock.assistantConversation.findFirst.mockResolvedValue(null);
    await expect(askDocumentAssistant("etab-1", "dt-pca", "conv-autre", "q")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.assistantConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "conv-autre", userId: "u-eval", establishmentId: "etab-1", documentTypeId: "dt-pca" } })
    );
  });

  it("échec du modèle après consommation : les crédits se décomptent quand même", async () => {
    reply.mockRejectedValue(new AssistantChatError("refusée", 0.003));
    expect(await askDocumentAssistant("etab-1", "dt-pca", null, "q")).toEqual({ error: "refusée" });
    expect(prismaMock.assistantCreditDay.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ used: { increment: 2 } }) })
    );
  });

  it("sans clé OpenRouter : indisponible, rien n'est écrit", async () => {
    getAssistantChatPort.mockReturnValue(null);
    expect(await askDocumentAssistant("etab-1", "dt-pca", null, "q")).toMatchObject({ error: expect.stringContaining("configuré") });
    expect(prismaMock.assistantConversation.create).not.toHaveBeenCalled();
  });
});

describe("getDocumentAssistant", () => {
  it("lit en lecture les conversations de l'appelant seulement, et ses crédits", async () => {
    const state = await getDocumentAssistant("etab-1", "dt-pca");
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "READ");
    expect(prismaMock.assistantConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u-eval", establishmentId: "etab-1", documentTypeId: "dt-pca" } })
    );
    expect(state).toMatchObject({ available: true, credits: { used: 5, limit: 40 } });
  });
});

describe("resolveAssistantProposal", () => {
  const pending = (kind: string) => ({
    id: "m-1",
    proposalsJson: [{ kind, text: "Le DPO est nommé page 4.", status: "PENDING" }],
    conversation: { documentTypeId: "dt-pca" },
  });

  it("confirmer une consigne l'ajoute au fil par l'action réelle, puis marque la carte", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue(pending("COMMENT"));
    addDocumentComment.mockResolvedValue(null);
    expect(await resolveAssistantProposal("etab-1", "m-1", 0, "CONFIRM")).toBeNull();
    expect(addDocumentComment).toHaveBeenCalledWith("etab-1", "dt-pca", "Le DPO est nommé page 4.", true);
    expect(prismaMock.assistantMessage.update).toHaveBeenCalledWith({
      where: { id: "m-1" },
      data: { proposalsJson: [{ kind: "COMMENT", text: "Le DPO est nommé page 4.", status: "APPLIED" }] },
    });
  });

  it("confirmer une demande passe par requestInformationFromStructure", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue(pending("INFORMATION_REQUEST"));
    requestInformationFromStructure.mockResolvedValue({ ok: true, notified: 1 });
    expect(await resolveAssistantProposal("etab-1", "m-1", 0, "CONFIRM")).toBeNull();
    const form = requestInformationFromStructure.mock.calls[0]?.[0] as FormData;
    expect(form.get("documentTypeId")).toBe("dt-pca");
    expect(form.get("title")).toBe("Le DPO est nommé page 4.");
  });

  it("message d'une conversation d'un autre compte : notFound, rien n'est rejoué", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue(null);
    await expect(resolveAssistantProposal("etab-1", "m-x", 0, "CONFIRM")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.assistantMessage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m-x", role: "ASSISTANT", conversation: { userId: "u-eval", establishmentId: "etab-1" } },
      })
    );
    expect(addDocumentComment).not.toHaveBeenCalled();
  });

  it("carte déjà traitée ou trafiquée : refusée", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue({
      ...pending("COMMENT"),
      proposalsJson: [{ kind: "VALIDATE_DOCUMENT", text: "x", status: "PENDING" }, { kind: "COMMENT", text: "y", status: "APPLIED" }],
    });
    expect(await resolveAssistantProposal("etab-1", "m-1", 0, "CONFIRM")).toMatchObject({ error: expect.any(String) });
    expect(addDocumentComment).not.toHaveBeenCalled();
  });

  it("écarter ne rejoue rien", async () => {
    prismaMock.assistantMessage.findFirst.mockResolvedValue(pending("COMMENT"));
    expect(await resolveAssistantProposal("etab-1", "m-1", 0, "DISMISS")).toBeNull();
    expect(addDocumentComment).not.toHaveBeenCalled();
  });
});

describe("deleteAssistantConversation", () => {
  it("supprime seulement une conversation de l'appelant", async () => {
    prismaMock.assistantConversation.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteAssistantConversation("etab-1", "conv-autre")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.assistantConversation.deleteMany).toHaveBeenCalledWith({
      where: { id: "conv-autre", userId: "u-eval", establishmentId: "etab-1" },
    });
  });
});
