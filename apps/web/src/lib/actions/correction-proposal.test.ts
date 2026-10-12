import { beforeEach, describe, expect, it, vi } from "vitest";

// Mettre en conformité (N8). Ce qui est protégé : le DROIT de générer (correctionScope,
// D11, D13) avant tout appel au modèle, des deux côtés ; la structure n'ouvre l'écran
// qu'en autonomie ET avec ce droit (sinon introuvable) ; « Enregistrer la version N+1 »
// valide les décisions, refuse une proposition déjà appliquée ou une version dépassée,
// crée une NOUVELLE version liée à l'originale (origine selon l'auteur) et fige les
// décisions. correction-context et les règles d'offre tournent pour de vrai ; seules
// les frontières (base, stockage, LLM, garde) sont doublées.

const prismaMock = {
  mission: { findUnique: vi.fn() },
  documentVersion: { findUnique: vi.fn() },
  correctionProposal: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  criterion: { findMany: vi.fn() },
};
const requireEstablishmentAccess = vi.fn();
const generateCorrectedDraft = vi.fn();
const ingestDocumentVersion = vi.fn();
const recordAuditEvent = vi.fn();
class NotFound extends Error {}

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({ requireEstablishmentAccess: (id: string) => requireEstablishmentAccess(id) }));
vi.mock("@/lib/services/document-generation-service", () => ({
  generateCorrectedDraft: (...args: unknown[]) => generateCorrectedDraft(...args),
}));
vi.mock("@/lib/services/document-ingestion-service", () => ({
  ingestDocumentVersion: (...args: unknown[]) => ingestDocumentVersion(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args) }));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({}) }));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}), isKnownLlmModelId: () => false }));

const { applyCorrectionProposal, generateCorrectionProposal, getCorrectionWorkspace } = await import("./correction-proposal");

const ETAB = "etab-fictif";
const ANALYSIS = { elementsPresents: [], elementsManquants: ["Horaires"], suggestionsCorrection: [], sembleConforme: false };
const PROPOSAL = {
  schemaVersion: 1,
  segments: [
    { kind: "ORIGINAL", text: "Article 1 — Objet" },
    { kind: "AJOUT", id: "a1", text: "Permanence : [À compléter : horaires].", criterionCode: "3.12.1", reason: "Informer.", manualQuote: null, anchor: null },
    { kind: "AJOUT", id: "a2", text: "Réclamation sous 15 jours.", criterionCode: null, reason: "Plaintes.", manualQuote: null, anchor: null },
  ],
};
const CABINET = { userId: "user-cab", isClient: false, establishmentId: ETAB, session: { user: { role: "CABINET_ADMIN" } }, missionAccess: "ACTIVE" };
const CLIENT = { ...CABINET, userId: "user-client", isClient: true, session: { user: { role: "CLIENT_USER" } } };

function givenVersion(category: string, overrides: { current?: boolean; reviewedAt?: Date | null } = {}) {
  prismaMock.documentVersion.findUnique.mockResolvedValue({
    id: "dv-1",
    versionNumber: 1,
    extractedText: "Article 1 — Objet",
    analysisResultJson: ANALYSIS,
    analysisReviewedAt: overrides.reviewedAt ?? null,
    document: {
      id: "doc-1",
      establishmentId: ETAB,
      currentVersionId: overrides.current === false ? "dv-2" : "dv-1",
      documentTypeId: "dt-1",
      documentType: { id: "dt-1", label: "Règlement de fonctionnement", code: "L2002_REGLEMENT", category },
      establishment: { name: "SAD Les Glycines (fictif)" },
    },
  });
}
function givenMission(formule: string | null, supportMode = "ACCOMPAGNE") {
  prismaMock.mission.findUnique.mockResolvedValue(formule === null ? null : { formule, gratuit: false, supportMode });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue(CABINET);
  generateCorrectedDraft.mockResolvedValue({ ok: true, proposalId: "p-1", proposal: PROPOSAL });
  ingestDocumentVersion.mockResolvedValue({ documentId: "doc-1", documentVersionId: "dv-new", analysisSucceeded: true });
  prismaMock.correctionProposal.findUnique.mockResolvedValue({ id: "p-1", sourceVersionId: "dv-1", proposalJson: PROPOSAL, resultVersionId: null });
  prismaMock.correctionProposal.findFirst.mockResolvedValue(null);
  prismaMock.correctionProposal.update.mockResolvedValue({});
  prismaMock.criterion.findMany.mockResolvedValue([]);
});

describe("generateCorrectionProposal — droit de générer (D11, D13)", () => {
  it("refuse en Essentiel, avant tout appel au modèle", async () => {
    givenMission("ESSENTIEL");
    givenVersion("LOI_2002_2");
    expect(await generateCorrectionProposal("dv-1")).toMatchObject({ error: expect.stringContaining("option") });
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refuse en Performance hors périmètre, autorise la loi 2002-2", async () => {
    givenMission("PERFORMANCE");
    givenVersion("RH");
    expect(await generateCorrectionProposal("dv-1")).toMatchObject({ error: expect.any(String) });
    givenVersion("LOI_2002_2");
    expect(await generateCorrectionProposal("dv-1")).toBeNull();
    expect(generateCorrectedDraft).toHaveBeenCalledTimes(1);
  });

  it("autorise tout en Excellence, et le journalise", async () => {
    givenMission("EXCELLENCE");
    givenVersion("RH");
    expect(await generateCorrectionProposal("dv-1")).toBeNull();
    expect(generateCorrectedDraft).toHaveBeenCalledWith("dv-1", expect.anything(), null, "user-cab");
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "CORRECTED_DRAFT_GENERATED" }));
  });

  it("refuse sans mission (rien n'a été acheté)", async () => {
    givenMission(null);
    givenVersion("LOI_2002_2");
    expect(await generateCorrectionProposal("dv-1")).toMatchObject({ error: expect.any(String) });
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
  });

  it("mission close : plus de génération", async () => {
    givenMission("EXCELLENCE");
    givenVersion("LOI_2002_2");
    requireEstablishmentAccess.mockResolvedValue({ ...CABINET, missionAccess: "LIBRARY" });
    expect(await generateCorrectionProposal("dv-1")).toMatchObject({ error: expect.stringContaining("terminé") });
  });
});

describe("garde de l'écran — structure", () => {
  it("accompagnée : introuvable (c'est EODA qui met en conformité), même en Excellence", async () => {
    givenMission("EXCELLENCE", "ACCOMPAGNE");
    givenVersion("LOI_2002_2", { reviewedAt: new Date() });
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    await expect(generateCorrectionProposal("dv-1")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
  });

  it("autonomie SANS le droit (Essentiel) : introuvable", async () => {
    givenMission("ESSENTIEL", "AUTONOMIE");
    givenVersion("LOI_2002_2");
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    await expect(getCorrectionWorkspace("dv-1")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("autonomie AVEC le droit (Performance, loi 2002-2) : génère pour la structure", async () => {
    givenMission("PERFORMANCE", "AUTONOMIE");
    givenVersion("LOI_2002_2");
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    expect(await generateCorrectionProposal("dv-1")).toBeNull();
    expect(generateCorrectedDraft).toHaveBeenCalledWith("dv-1", expect.anything(), null, "user-client");
  });

  it("hors périmètre ou inconnue : introuvable", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(null);
    await expect(generateCorrectionProposal("dv-x")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(requireEstablishmentAccess).not.toHaveBeenCalled();
    givenVersion("LOI_2002_2");
    requireEstablishmentAccess.mockRejectedValue(new NotFound("NEXT_NOT_FOUND"));
    await expect(getCorrectionWorkspace("dv-1")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("l'espace de travail porte la réserve d'autonomie et la proposition stockée", async () => {
    givenMission("PERFORMANCE", "AUTONOMIE");
    givenVersion("LOI_2002_2");
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    prismaMock.correctionProposal.findFirst.mockResolvedValue({
      id: "p-1",
      generatedAt: new Date(),
      proposalJson: PROPOSAL,
      resultVersionId: null,
      decisionsJson: null,
    });
    const workspace = await getCorrectionWorkspace("dv-1");
    expect(workspace.mention).toMatch(/Non revérifié par un humain/);
    expect(workspace.proposal?.content.segments).toHaveLength(3);
    expect(workspace.canSave).toBe(true);
    expect(workspace.canGenerate).toBe(true);
  });
});

describe("applyCorrectionProposal — enregistrer la version N+1", () => {
  beforeEach(() => {
    givenMission("PERFORMANCE", "AUTONOMIE");
    givenVersion("LOI_2002_2");
  });

  it("crée la version 2 liée à l'originale, avec les seuls ajouts acceptés, et fige les décisions", async () => {
    requireEstablishmentAccess.mockResolvedValue(CLIENT);
    const result = await applyCorrectionProposal("p-1", { a1: "ACCEPTE", a2: "REFUSE" });
    expect(result).toEqual({ ok: true, versionNumber: 2 });

    const input = ingestDocumentVersion.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(input).toMatchObject({ regeneratedFromVersionId: "dv-1", documentOrigin: "CLIENT", uploadedByUserId: "user-client" });
    expect(input.extractedText).toContain("Permanence");
    expect(input.extractedText).not.toContain("Réclamation sous 15 jours");
    expect(String(input.originalFilename)).toMatch(/_v02_Externe\.docx$/);
    expect((input.content as Buffer).subarray(0, 2).toString("latin1")).toBe("PK");

    const update = prismaMock.correctionProposal.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data).toMatchObject({ resultVersionId: "dv-new", appliedById: "user-client" });
    expect(update.data.decisionsJson).toMatchObject({ decisions: [{ id: "a1", decision: "ACCEPTE" }, { id: "a2", decision: "REFUSE" }] });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "CORRECTION_PROPOSAL_APPLIED", targetId: "dv-new" }));
  });

  it("origine cabinet quand c'est le cabinet qui enregistre", async () => {
    await applyCorrectionProposal("p-1", { a1: "ACCEPTE" });
    expect(ingestDocumentVersion.mock.calls[0]?.[0]).toMatchObject({ documentOrigin: "CABINET" });
  });

  it.each([
    [{ inconnu: "ACCEPTE" }, /n'existe pas/],
    [{ a1: "PEUT-ETRE" }, /Accepter ou Refuser/],
    ["texte", /illisibles/],
  ])("refuse des décisions invalides (%#)", async (decisions, message) => {
    expect(await applyCorrectionProposal("p-1", decisions)).toEqual({ error: expect.stringMatching(message) });
    expect(ingestDocumentVersion).not.toHaveBeenCalled();
  });

  it("refuse une proposition déjà enregistrée, ou portant sur une version dépassée", async () => {
    prismaMock.correctionProposal.findUnique.mockResolvedValue({ id: "p-1", sourceVersionId: "dv-1", proposalJson: PROPOSAL, resultVersionId: "dv-2" });
    expect(await applyCorrectionProposal("p-1", {})).toEqual({ error: expect.stringMatching(/déjà été enregistrée/) });
    prismaMock.correctionProposal.findUnique.mockResolvedValue({ id: "p-1", sourceVersionId: "dv-1", proposalJson: PROPOSAL, resultVersionId: null });
    givenVersion("LOI_2002_2", { current: false });
    expect(await applyCorrectionProposal("p-1", {})).toEqual({ error: expect.stringMatching(/plus récente/) });
    expect(ingestDocumentVersion).not.toHaveBeenCalled();
  });

  it("proposition inconnue : introuvable", async () => {
    prismaMock.correctionProposal.findUnique.mockResolvedValue(null);
    await expect(applyCorrectionProposal("p-x", {})).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
