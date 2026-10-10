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
  documentVersion: { findUnique: vi.fn() },
};

const ingestDocumentVersion = vi.fn();
const generateCorrectedDraft = vi.fn();
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
vi.mock("@/lib/services/document-generation-service", () => ({
  generateCorrectedDraft: (...args: unknown[]) => generateCorrectedDraft(...args),
  saveCorrectedDraft: vi.fn(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/security/upload-validation-service", () => ({
  validateUploadedFile: () => ({ ok: true, contentType: "application/pdf" }),
}));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({}) }));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}) }));

const { uploadDocument, respondToMissingDocument, generateDocumentDraft } = await import("./document");

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

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, RH_TYPE.id, "NOT_CONCERNED", "n/a");

    expect(result).toEqual({
      error: "Ce document n'entre pas dans le périmètre de l'offre souscrite pour cet établissement.",
    });
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("accepte une réponse sur un document couvert par l'offre", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, LOI_TYPE.id, "WILL_PROVIDE", "en cours");

    expect(result).toBeNull();
    expect(prismaMock.document.upsert).toHaveBeenCalledTimes(1);
  });

  it("n'oppose aucun périmètre à un établissement sans mission (avant-vente)", async () => {
    givenMission(null);
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, RH_TYPE.id, "WILL_PROVIDE", null);

    expect(result).toBeNull();
    expect(prismaMock.document.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("respondToMissingDocument — « Je ne l'ai pas » (N3)", () => {
  it("garde le document MANQUANT, à produire — jamais NOT_APPLICABLE", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, LOI_TYPE.id, "DONT_HAVE", null);

    expect(result).toBeNull();
    const call = prismaMock.document.upsert.mock.calls[0]?.[0] as {
      update: { status: string; statusOverriddenByUser: boolean };
      create: { status: string; statusOverriddenByUser: boolean };
    };
    expect(call.update).toMatchObject({ status: "MISSING", statusOverriddenByUser: true });
    expect(call.create).toMatchObject({ status: "MISSING", statusOverriddenByUser: true });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_STATUS_ANSWERED", detail: `${LOI_TYPE.code} → DONT_HAVE` })
    );
  });

  it("refuse « non concerné » sur un document de la loi 2002-2, sans rien écrire", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, LOI_TYPE.id, "NOT_CONCERNED", null);

    expect(result).toMatchObject({ error: expect.stringContaining("loi 2002-2") });
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
  });

  it("accepte « non concerné » hors loi 2002-2", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, RH_TYPE.id, "NOT_CONCERNED", null);

    expect(result).toBeNull();
    expect(prismaMock.document.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ status: "NOT_APPLICABLE" }) })
    );
  });

  it("refuse une réponse inconnue (entrée non fiable), sans lire ni écrire", async () => {
    // L'ancien booléen ne passe plus : il n'est pas une réponse.
    for (const raw of ["MAYBE", true, null]) {
      expect(await respondToMissingDocument(ESTABLISHMENT_ID, LOI_TYPE.id, raw, null)).toEqual({
        error: "Réponse invalide.",
      });
    }
    expect(prismaMock.documentType.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
  });

  it("propage le refus de la garde (autre établissement, non authentifié)", async () => {
    requireEstablishmentAccess.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(
      respondToMissingDocument("etab-autre", LOI_TYPE.id, "DONT_HAVE", null)
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
  });
});

describe("generateDocumentDraft — droit de générer (correctionScope, D11, D13)", () => {
  const CABINET_ACCESS = {
    userId: "user-cab",
    isClient: false,
    session: { user: { role: "CABINET_ADMIN" } },
    missionAccess: "ACTIVE",
  };

  function givenVersion(category: string | null): void {
    prismaMock.documentVersion.findUnique.mockResolvedValue({
      document: {
        establishmentId: ESTABLISHMENT_ID,
        documentType: category ? { code: "CODE", category } : null,
      },
    });
  }

  beforeEach(() => {
    requireEstablishmentAccess.mockResolvedValue(CABINET_ACCESS);
    generateCorrectedDraft.mockResolvedValue({ ok: true });
  });

  it("refuse en Essentiel, avant tout appel au modèle", async () => {
    givenMission("ESSENTIEL");
    givenVersion("LOI_2002_2");

    const result = await generateDocumentDraft("dv-1");

    expect(result).toMatchObject({ error: expect.stringContaining("option") });
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refuse en Performance un document hors du périmètre impératifs + procédures", async () => {
    givenMission("PERFORMANCE");
    givenVersion("RH");

    expect(await generateDocumentDraft("dv-1")).toMatchObject({ error: expect.any(String) });
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
  });

  it("autorise en Performance un document de la loi 2002-2", async () => {
    givenMission("PERFORMANCE");
    givenVersion("LOI_2002_2");

    expect(await generateDocumentDraft("dv-1")).toBeNull();
    expect(generateCorrectedDraft).toHaveBeenCalledTimes(1);
  });

  it("autorise tout en Excellence, et le journalise", async () => {
    givenMission("EXCELLENCE");
    givenVersion("RH");

    expect(await generateDocumentDraft("dv-1")).toBeNull();
    expect(generateCorrectedDraft).toHaveBeenCalledTimes(1);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "CORRECTED_DRAFT_GENERATED" }));
  });

  it("refuse sans mission (rien n'a été acheté)", async () => {
    givenMission(null);
    givenVersion("LOI_2002_2");

    expect(await generateDocumentDraft("dv-1")).toMatchObject({ error: expect.any(String) });
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
  });

  it("refuse un document d'un autre tenant : la garde lève notFound", async () => {
    givenMission("EXCELLENCE");
    givenVersion("LOI_2002_2");
    requireEstablishmentAccess.mockRejectedValue(new Error("NEXT_NOT_FOUND"));

    await expect(generateDocumentDraft("dv-1")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
  });

  it("refuse un appelant CLIENT (notFound), même en Excellence", async () => {
    givenMission("EXCELLENCE");
    givenVersion("LOI_2002_2");
    requireEstablishmentAccess.mockResolvedValue({ ...CABINET_ACCESS, isClient: true });

    await expect(generateDocumentDraft("dv-1")).rejects.toThrow();
    expect(generateCorrectedDraft).not.toHaveBeenCalled();
  });

  it("répond notFound sur une version inconnue", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(null);
    await expect(generateDocumentDraft("dv-inconnue")).rejects.toThrow();
    expect(requireEstablishmentAccess).not.toHaveBeenCalled();
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
