import { inflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readZip } from "@/lib/services/zip-read";

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
  // Habillage du document final (E1, E2) : matrice du type, logo et couleurs.
  documentTypeCriterion: { findMany: vi.fn() },
  establishment: { findUnique: vi.fn() },
  // Modèle de mise en page de la structure (11/11/2026) : aucun par défaut.
  establishmentDocumentDesign: { findUnique: vi.fn().mockResolvedValue(null) },
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
// Gabarit du document final (11/11/2026) : aucun Word lisible par défaut → rendu EODA.
const storageDownload = vi.fn();
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({ download: (key: string) => storageDownload(key) }) }));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}), isKnownLlmModelId: () => false }));

const { applyCorrectionProposal, generateCorrectionProposal, getCorrectionWorkspace } = await import("./correction-proposal");
const { buildStoredZip } = await import("@/lib/services/zip-store");

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
    fileStorageKey: "documents/dv-1.docx",
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
  prismaMock.documentTypeCriterion.findMany.mockResolvedValue([]);
  prismaMock.establishment.findUnique.mockResolvedValue({ logoDataUri: null, brandPrimaryColor: null, brandSecondaryColor: null });
  storageDownload.mockRejectedValue(new Error("absent"));
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

// Le tampon de la structure (ADR 20261110) : aucune IA ne le lit, l'écran côte à côte et
// ses exports n'existent pas pour lui — même pour l'administration, même en Excellence.
describe("document à accès restreint — pas de mise en conformité", () => {
  it("introuvable pour le cabinet, avant tout appel au modèle", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentVersion.findUnique.mockResolvedValue({
      id: "dv-t",
      versionNumber: 1,
      extractedText: "texte d'un dépôt antérieur",
      analysisResultJson: ANALYSIS,
      analysisReviewedAt: null,
      document: {
        id: "doc-t",
        establishmentId: ETAB,
        currentVersionId: "dv-t",
        documentTypeId: "dt-t",
        documentType: { id: "dt-t", label: "Tampon", code: "DEPARTEMENT_TAMPON", category: "FONCTIONNEMENT" },
        establishment: { name: "SAD Les Glycines (fictif)" },
      },
    });
    await expect(generateCorrectionProposal("dv-t")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(getCorrectionWorkspace("dv-t")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
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

  // 11/11/2026 : « la mise en conformité ne garde pas le design des documents ». Le Word
  // d'origine du client sert de gabarit : ses styles et son en-tête restent, le corps change.
  it("garde le design du client : le Word d'origine sert de gabarit", async () => {
    const enc = (text: string) => new TextEncoder().encode(text);
    const at = new Date(2026, 0, 1);
    storageDownload.mockResolvedValue(
      Buffer.from(
        buildStoredZip([
          { name: "word/document.xml", data: enc('<w:document xmlns:w="w"><w:body><w:p/><w:sectPr><w:headerReference r:id="rId9"/></w:sectPr></w:body></w:document>'), modifiedAt: at },
          { name: "word/styles.xml", data: enc('<w:styles><w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/></w:style></w:styles>'), modifiedAt: at },
          { name: "word/header1.xml", data: enc("<w:hdr>LOGO DE LA STRUCTURE</w:hdr>"), modifiedAt: at },
        ])
      )
    );
    expect(await applyCorrectionProposal("p-1", { a1: "ACCEPTE", a2: "REFUSE" })).toEqual({ ok: true, versionNumber: 2 });
    expect(storageDownload).toHaveBeenCalledWith("documents/dv-1.docx");
    const input = ingestDocumentVersion.mock.calls[0]?.[0] as { content: Buffer };
    const entries = await readZip(new Uint8Array(input.content), async (d) => new Uint8Array(inflateRawSync(d)));
    const text = (name: string) => new TextDecoder().decode(entries.find((e) => e.name === name)?.data);
    expect(text("word/header1.xml")).toBe("<w:hdr>LOGO DE LA STRUCTURE</w:hdr>");
    expect(text("word/document.xml")).toContain("Permanence");
    expect(text("word/document.xml")).toContain('<w:headerReference r:id="rId9"/>');
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

  it("la PLATEFORME écrit la version suivante et la date du jour, et retire les encarts de critères (E2, E3)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T10:00:00Z"));
    try {
      prismaMock.correctionProposal.findUnique.mockResolvedValue({
        id: "p-1",
        sourceVersionId: "dv-1",
        resultVersionId: null,
        proposalJson: {
          ...PROPOSAL,
          segments: [
            { kind: "ORIGINAL", text: "# Règlement\nVersion : 1\nDate de mise à jour : 11/10/2026" },
            { kind: "ORIGINAL", text: "## Critères HAS couverts\n- 3.12.1" },
            ...PROPOSAL.segments.slice(1),
          ],
        },
      });
      await applyCorrectionProposal("p-1", { a1: "ACCEPTE" });
      const input = ingestDocumentVersion.mock.calls[0]?.[0] as { extractedText: string };
      expect(input.extractedText).toContain("Version : 1.1\nDate de mise à jour : 10/11/2026");
      expect(input.extractedText).not.toContain("Critères HAS couverts");
      expect(recordAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CORRECTION_PROPOSAL_APPLIED", detail: expect.stringContaining("version du document 1.1") })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("sans bloc d'identification : une ligne normalisée est ajoutée en tête", async () => {
    await applyCorrectionProposal("p-1", {});
    const input = ingestDocumentVersion.mock.calls[0]?.[0] as { extractedText: string };
    expect(input.extractedText.split("\n")[0]).toMatch(/^\*\*Version :\*\* 1\.1 · \*\*Date de mise à jour :\*\* \d{2}\/\d{2}\/\d{4}$/);
  });

  it("page de garde EODA depuis la MATRICE du type, couleurs de la structure dans le document (E1, E2)", async () => {
    prismaMock.documentTypeCriterion.findMany.mockResolvedValue([{ criterion: { code: "3.12.1", label: "Plaintes et réclamations" } }]);
    prismaMock.establishment.findUnique.mockResolvedValue({ logoDataUri: null, brandPrimaryColor: "#1A4D8F", brandSecondaryColor: null });
    await applyCorrectionProposal("p-1", { a1: "ACCEPTE" });

    expect(prismaMock.documentTypeCriterion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { documentTypeId: "dt-1" } }));
    expect(prismaMock.establishment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ETAB } }));
    const input = ingestDocumentVersion.mock.calls[0]?.[0] as { content: Buffer; extractedText: string };
    const entries = await readZip(new Uint8Array(input.content), async (d) => new Uint8Array(inflateRawSync(d)));
    const body = Buffer.from(entries.find((e) => e.name === "word/document.xml")!.data).toString("utf8");
    const coverEnd = body.indexOf("<w:sectPr");
    expect(body.slice(0, coverEnd)).toContain("Plaintes et réclamations");
    expect(body.slice(coverEnd)).toContain("1A4D8F");
    // La page de garde n'entre pas dans le texte de la version : le document seul.
    expect(input.extractedText).not.toContain("Ce que couvre ce document");
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
