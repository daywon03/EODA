import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS des mutations documentaires face au périmètre de l'offre (D7).
// Règles de référence : .claude/context/07-outil-pilotage-missions.md §12.1 / §12.4
// et .claude/context/08-offre-commerciale-v10.md §04 — en Essentiel, seule la
// catégorie LOI_2002_2 est suivie. Sans mission, rien n'est contracté : la
// checklist complète est affichée (avant-vente), donc le dépôt ne doit PAS être
// bloqué. La logique d'offre elle-même n'est pas simulée : offer-scope-service est
// exécuté pour de vrai, seules les frontières (base, stockage, LLM) sont doublées.

const prismaMock = {
  mission: { findUnique: vi.fn() },
  documentType: { findMany: vi.fn(), findUnique: vi.fn() },
  document: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  establishment: { findUnique: vi.fn() },
};

const notifyDocumentAvailable = vi.fn();

const ingestDocumentVersion = vi.fn();
const recordAuditEvent = vi.fn();
const extractMarkdown = vi.fn();
const suggestDocumentType = vi.fn();
const requireEstablishmentAccess = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
  tryEstablishmentAccess: vi.fn(),
}));
vi.mock("@/lib/services/text-extraction-service", () => ({
  extractMarkdown: (...args: unknown[]) => extractMarkdown(...args),
}));
vi.mock("@/lib/services/document-categorization-service", () => ({
  suggestDocumentType: (...args: unknown[]) => suggestDocumentType(...args),
}));
vi.mock("@/lib/services/document-ingestion-service", () => ({
  ingestDocumentVersion: (...args: unknown[]) => ingestDocumentVersion(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/upload-validation-service", () => ({
  validateUploadedFile: () => ({ ok: true, contentType: "application/pdf" }),
}));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({}) }));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}) }));
vi.mock("@/lib/email/notifications", () => ({
  notifyDocumentAvailable: (...args: unknown[]) => notifyDocumentAvailable(...args),
}));

const { uploadDocument, respondToMissingDocument, setDocumentValidated } = await import(
  "./document"
);

const ESTABLISHMENT_ID = "etab-1";

const LOI_TYPE = {
  id: "dt-loi",
  code: "DIPC",
  label: "Document individuel de prise en charge",
  category: "LOI_2002_2",
};
const RH_TYPE = {
  id: "dt-rh",
  code: "PLAN_FORMATION",
  label: "Plan de formation",
  category: "RH",
};

function uploadForm(documentTypeId: string): FormData {
  const formData = new FormData();
  formData.set("establishmentId", ESTABLISHMENT_ID);
  formData.set("file", new File([Buffer.from("%PDF-1.4 contenu")], "doc.pdf"));
  formData.set("documentTypeId", documentTypeId);
  return formData;
}

function givenMission(formule: string | null, gratuit = false): void {
  prismaMock.mission.findUnique.mockResolvedValue(
    formule === null ? null : { formule, gratuit }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue({
    userId: "user-1",
    session: { user: { role: "CLIENT_USER" } },
    isClient: true,
    // Mission en cours par défaut : le dépôt s'arrête à la clôture (§12.5).
    missionAccess: "ACTIVE",
  });
  notifyDocumentAvailable.mockResolvedValue({ sent: 2, total: 2 });
  prismaMock.establishment.findUnique.mockResolvedValue({ name: "Structure test" });
  extractMarkdown.mockResolvedValue({ markdown: "texte extrait", images: [] });
  ingestDocumentVersion.mockResolvedValue({ documentVersionId: "dv-1" });
  recordAuditEvent.mockResolvedValue(undefined);
  prismaMock.document.upsert.mockResolvedValue({});
});

describe("uploadDocument — périmètre de l'offre", () => {
  it("refuse un document hors offre : rien n'est stocké, aucune analyse déclenchée", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    const result = await uploadDocument(uploadForm(RH_TYPE.id));

    expect(result).toEqual({
      error: "Ce document n'entre pas dans le périmètre de l'offre souscrite pour cet établissement.",
    });
    expect(ingestDocumentVersion).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("accepte un document couvert par l'offre Essentiel", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    const result = await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(result).toEqual({ success: true, documentTypeId: LOI_TYPE.id });
    expect(ingestDocumentVersion).toHaveBeenCalledTimes(1);
  });

  it("déstructure { markdown, images } de extractMarkdown et transmet les deux à l'ingestion", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);
    const image = { position: 1, contentType: "image/png", buffer: Buffer.from("x") };
    extractMarkdown.mockResolvedValue({ markdown: "texte [Image 1]", images: [image] });

    await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(ingestDocumentVersion).toHaveBeenCalledWith(
      expect.objectContaining({ extractedText: "texte [Image 1]", extractedImages: [image] }),
      expect.anything()
    );
  });

  it("n'oppose aucun périmètre à un établissement sans mission (avant-vente)", async () => {
    givenMission(null);
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    const result = await uploadDocument(uploadForm(RH_TYPE.id));

    expect(result).toEqual({ success: true, documentTypeId: RH_TYPE.id });
    expect(ingestDocumentVersion).toHaveBeenCalledTimes(1);
  });

  it("ouvre toutes les catégories à un bêta-test gratuit", async () => {
    givenMission("ESSENTIEL", true);
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    await expect(uploadDocument(uploadForm(RH_TYPE.id))).resolves.toEqual({
      success: true,
      documentTypeId: RH_TYPE.id,
    });
  });

  it("restreint les candidats de la détection automatique aux catégories couvertes", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findMany.mockResolvedValue([LOI_TYPE]);
    suggestDocumentType.mockReturnValue(null);

    const formData = uploadForm("");
    formData.delete("documentTypeId");
    const result = await uploadDocument(formData);

    expect(prismaMock.documentType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: { in: ["LOI_2002_2"] } } })
    );
    expect(result).toMatchObject({ needsManualType: true, candidates: [expect.anything()] });
  });
});

describe("respondToMissingDocument — périmètre de l'offre", () => {
  it("refuse de répondre sur un document hors offre, sans rien écrire", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, RH_TYPE.id, false, "n/a");

    expect(result).toEqual({
      error: "Ce document n'entre pas dans le périmètre de l'offre souscrite pour cet établissement.",
    });
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("accepte une réponse sur un document couvert par l'offre", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, LOI_TYPE.id, true, "en cours");

    expect(result).toBeNull();
    expect(prismaMock.document.upsert).toHaveBeenCalledTimes(1);
  });

  it("n'oppose aucun périmètre à un établissement sans mission (avant-vente)", async () => {
    givenMission(null);
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, RH_TYPE.id, true, null);

    expect(result).toBeNull();
    expect(prismaMock.document.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("uploadDocument — fin de mission", () => {
  it("refuse le dépôt quand la mission est close, sans rien stocker ni analyser", async () => {
    // La bibliothèque est en LECTURE SEULE : les documents restent consultables,
    // l'écriture s'arrête. Le refus est côté serveur — masquer le bouton ne protège
    // pas une route HTTP publique.
    requireEstablishmentAccess.mockResolvedValue({
      userId: "user-1",
      session: { user: { role: "CLIENT_USER" } },
      missionAccess: "LIBRARY",
    });

    const result = await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(result).toMatchObject({ error: expect.stringContaining("terminé") });
    expect(ingestDocumentVersion).not.toHaveBeenCalled();
    expect(extractMarkdown).not.toHaveBeenCalled();
  });
});

// ── Annonce au client d'un document validé (27/09/2026) ─────────────────────

function asCabinet(missionAccess = "ACTIVE"): void {
  requireEstablishmentAccess.mockResolvedValue({
    userId: "sandrine",
    session: { user: { role: "CABINET_ADMIN" } },
    isClient: false,
    missionAccess,
  });
}

// Lecture faite par l'annonce : intitulé du type et versions produites par EODA.
function givenAnnouncedDocument(hasCabinetVersion: boolean): void {
  prismaMock.document.findUnique.mockResolvedValue({
    id: "doc-1",
    validatedAt: null,
    currentVersionId: "dv-1",
    documentType: { label: LOI_TYPE.label },
    versions: hasCabinetVersion ? [{ id: "dv-2" }] : [],
  });
}

describe("setDocumentValidated — le client est prévenu", () => {
  it("annonce un LIVRABLE quand EODA a produit une version, et rend le nombre de personnes prévenues", async () => {
    asCabinet();
    givenAnnouncedDocument(true);

    const result = await setDocumentValidated(ESTABLISHMENT_ID, LOI_TYPE.id, true);

    expect(result).toEqual({ notified: { sent: 2, total: 2 } });
    expect(notifyDocumentAvailable).toHaveBeenCalledWith({
      establishmentId: ESTABLISHMENT_ID,
      establishmentName: "Structure test",
      documentLabel: LOI_TYPE.label,
      kind: "DELIVERABLE",
    });
  });

  it("annonce une PIÈCE VALIDÉE quand seul le client a déposé — EODA n'a rien remis", async () => {
    asCabinet();
    givenAnnouncedDocument(false);

    await setDocumentValidated(ESTABLISHMENT_ID, LOI_TYPE.id, true);

    expect(notifyDocumentAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "VALIDATED_PIECE" })
    );
  });

  it("ne prévient personne quand la validation est RETIRÉE", async () => {
    asCabinet();
    prismaMock.document.findUnique.mockResolvedValue({
      id: "doc-1",
      validatedAt: new Date("2026-09-20T09:00:00Z"),
      currentVersionId: "dv-1",
    });

    const result = await setDocumentValidated(ESTABLISHMENT_ID, LOI_TYPE.id, false);

    expect(result).toBeNull();
    expect(notifyDocumentAvailable).not.toHaveBeenCalled();
  });

  it("ne prévient pas un client dont l'accès est révoqué", async () => {
    asCabinet("REVOKED");
    givenAnnouncedDocument(true);

    const result = await setDocumentValidated(ESTABLISHMENT_ID, LOI_TYPE.id, true);

    expect(result).toEqual({ notified: { sent: 0, total: 0 } });
    expect(notifyDocumentAvailable).not.toHaveBeenCalled();
  });
});

describe("uploadDocument — annonce d'une nouvelle version", () => {
  it("prévient le client quand EODA dépose sur un document DÉJÀ validé", async () => {
    // La nouvelle version devient le livrable sur-le-champ.
    asCabinet();
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);
    prismaMock.document.findUnique.mockResolvedValue({
      validatedAt: new Date("2026-09-20T09:00:00Z"),
      documentType: { label: LOI_TYPE.label },
      versions: [{ id: "dv-2" }],
    });

    await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(notifyDocumentAvailable).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "DELIVERABLE" })
    );
  });

  it("ne prévient personne quand EODA dépose sur un document non validé — travail en cours", async () => {
    asCabinet();
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);
    prismaMock.document.findUnique.mockResolvedValue({ validatedAt: null });

    await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(notifyDocumentAvailable).not.toHaveBeenCalled();
  });

  it("ne s'annonce pas à lui-même un dépôt du client", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(prismaMock.document.findUnique).not.toHaveBeenCalled();
    expect(notifyDocumentAvailable).not.toHaveBeenCalled();
  });
});
