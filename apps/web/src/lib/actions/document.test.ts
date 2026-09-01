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
  document: { upsert: vi.fn() },
};

const ingestDocumentVersion = vi.fn();
const recordAuditEvent = vi.fn();
const extractText = vi.fn();
const suggestDocumentType = vi.fn();
const requireEstablishmentAccess = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
  tryEstablishmentAccess: vi.fn(),
}));
vi.mock("@/lib/services/text-extraction-service", () => ({
  extractText: (...args: unknown[]) => extractText(...args),
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

const { uploadDocument, respondToMissingDocument } = await import("./document");

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
    // Mission en cours par défaut : le dépôt s'arrête à la clôture (§12.5).
    missionAccess: "ACTIVE",
  });
  extractText.mockResolvedValue("texte extrait");
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
    expect(extractText).not.toHaveBeenCalled();
  });
});
