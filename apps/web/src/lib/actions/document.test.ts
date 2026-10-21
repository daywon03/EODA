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
  document: { upsert: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  documentVersion: { findUnique: vi.fn(), update: vi.fn() },
  establishment: { findUnique: vi.fn() },
  criterion: { findMany: vi.fn() },
  criterionGuideline: { findFirst: vi.fn(), update: vi.fn(), createMany: vi.fn() },
  // La transaction rejoue le rappel sur les mêmes doubles : ce qui compte est ce
  // qu'elle écrit.
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prismaMock)),
};

const notifyDocumentAvailable = vi.fn();
const notifyStructureActivity = vi.fn();

const ingestDocumentVersion = vi.fn();
const generateCorrectedDraft = vi.fn();
const generateCorrectionProposal = vi.fn();
const recordAuditEvent = vi.fn();
const extractMarkdown = vi.fn();
const suggestDocumentType = vi.fn();
const requireEstablishmentAccess = vi.fn();
const requireCabinetSession = vi.fn();
// `tryEstablishmentAccess` — la garde qui a servi jusqu'ici sans être doublée : elle
// répond, dans ces tests, ce que la session serait (cabinet ou structure).
const tryEstablishmentAccess = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
  requireCabinetSession: (...args: unknown[]) => requireCabinetSession(...args),
  tryEstablishmentAccess: (...args: unknown[]) => tryEstablishmentAccess(...args),
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
vi.mock("./correction-proposal", () => ({
  generateCorrectionProposal: (...args: unknown[]) => generateCorrectionProposal(...args),
}));
vi.mock("@/lib/llm", () => ({ getLLMAnalysisPort: () => ({}) }));
vi.mock("@/lib/email/notifications", () => ({
  notifyDocumentAvailable: (...args: unknown[]) => notifyDocumentAvailable(...args),
  notifyStructureActivity: (...args: unknown[]) => notifyStructureActivity(...args),
}));

const {
  uploadDocument,
  respondToMissingDocument,
  generateDocumentDraft,
  setDocumentValidated,
  getDocumentPreviewData,
  setCriterionGuidelineAiUse,
  setDocumentCommentAiUse,
  setParticipationForm,
  addCriterionGuidelines,
} = await import("./document");

describe("setDocumentCommentAiUse — « Commentaire sur ce document » remis à l'IA", () => {
  it("passe par la garde d'écriture, bascule le seul drapeau et journalise sans le commentaire", async () => {
    prismaMock.document.findUnique.mockResolvedValue({ id: "doc-1", commentUsedByAi: true, documentType: { code: "CVS" } });
    expect(await setDocumentCommentAiUse("etab-1", "dt-cvs", false)).toBeNull();
    expect(requireEstablishmentAccess).toHaveBeenCalledWith("etab-1", expect.objectContaining({ mode: "WRITE" }));
    expect(prismaMock.document.update).toHaveBeenCalledWith({ where: { id: "doc-1" }, data: { commentUsedByAi: false } });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_COMMENT_AI_TOGGLED", detail: "CVS · non" }));
  });

  it("n'écrit rien quand le document n'existe pas ou que l'état est déjà le bon", async () => {
    prismaMock.document.findUnique.mockResolvedValue(null);
    expect(await setDocumentCommentAiUse("etab-1", "dt-cvs", false)).toMatchObject({ error: expect.any(String) });
    prismaMock.document.findUnique.mockResolvedValue({ id: "doc-1", commentUsedByAi: true, documentType: { code: "CVS" } });
    expect(await setDocumentCommentAiUse("etab-1", "dt-cvs", true)).toBeNull();
    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });
});

// « Pouvoir oui ou non le faire prendre en compte par l'IA » (call du 18/10/2026).
describe("setCriterionGuidelineAiUse", () => {
  beforeEach(() => {
    requireCabinetSession.mockResolvedValue({ tenantId: "tenant-1", userId: "u-cab", session: { user: { role: "CABINET_ADMIN" } } });
  });

  it("cherche la guideline DANS le cabinet de l'appelant, sinon notFound", async () => {
    prismaMock.criterionGuideline.findFirst.mockResolvedValue(null);
    await expect(setCriterionGuidelineAiUse("g-autre", false)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prismaMock.criterionGuideline.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "g-autre", tenantId: "tenant-1" } })
    );
    expect(prismaMock.criterionGuideline.update).not.toHaveBeenCalled();
  });

  it("bascule l'usage seul, jamais le texte, et le journalise", async () => {
    prismaMock.criterionGuideline.findFirst.mockResolvedValue({ id: "g-1", aiEnabled: true });
    expect(await setCriterionGuidelineAiUse("g-1", false)).toBeNull();
    expect(prismaMock.criterionGuideline.update).toHaveBeenCalledWith({ where: { id: "g-1" }, data: { aiEnabled: false } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CRITERION_GUIDELINE_AI_TOGGLED", targetId: "g-1", detail: "non" })
    );
  });

  it("n'écrit rien quand l'état demandé est déjà le bon", async () => {
    prismaMock.criterionGuideline.findFirst.mockResolvedValue({ id: "g-1", aiEnabled: true });
    expect(await setCriterionGuidelineAiUse("g-1", true)).toBeNull();
    expect(prismaMock.criterionGuideline.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

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
  notifyStructureActivity.mockResolvedValue({ sent: 1, total: 1 });
  prismaMock.establishment.findUnique.mockResolvedValue({ name: "Structure test" });
  extractMarkdown.mockResolvedValue({ markdown: "texte extrait", images: [] });
  ingestDocumentVersion.mockResolvedValue({ documentVersionId: "dv-1" });
  recordAuditEvent.mockResolvedValue(undefined);
  prismaMock.document.upsert.mockResolvedValue({});
});

describe("uploadDocument — version finale d'EODA (call du 18/10/2026)", () => {
  function cabinetAccess(): void {
    requireEstablishmentAccess.mockResolvedValue({
      userId: "consultante-1",
      session: { user: { role: "CABINET_ADMIN" } },
      isClient: false,
      missionAccess: "ACTIVE",
    });
  }

  function finalForm(): FormData {
    const formData = uploadForm(LOI_TYPE.id);
    formData.set("cabinetFinal", "1");
    return formData;
  }

  beforeEach(() => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);
    prismaMock.document.update.mockResolvedValue({ id: "doc-1" });
    // Relu deux fois après le dépôt : « déjà validé ? » puis, pour l'annonce, le type
    // et l'existence d'une version d'EODA.
    prismaMock.document.findUnique.mockResolvedValue({
      validatedAt: new Date(),
      documentType: { label: LOI_TYPE.label },
      versions: [{ id: "dv-1" }],
    });
  });

  // Dans une action serveur, revalidatePath fait embarquer à la réponse le rendu
  // complet de la page : l'écran tournait encore longtemps après la fin de l'analyse
  // (21/10/2026). L'appelant rafraîchit lui-même, à part (use-analysis-run).
  it("rend la main sans re-rendre la page : le rafraîchissement est celui de l'appelant", async () => {
    cabinetAccess();
    await uploadDocument(finalForm());
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un dépôt final du cabinet vaut validation : relu, validé, tracé, annoncé", async () => {
    cabinetAccess();

    await uploadDocument(finalForm());

    expect(prismaMock.documentVersion.update).toHaveBeenCalledWith({
      where: { id: "dv-1" },
      data: { analysisReviewedAt: expect.any(Date) },
    });
    expect(prismaMock.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { validatedAt: expect.any(Date), validatedByUserId: "consultante-1" } })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_VALIDATED", targetId: "doc-1" })
    );
    expect(notifyDocumentAvailable).toHaveBeenCalled();
  });

  it("décoché (dépôt pour le compte de la structure), rien n'est validé en silence", async () => {
    cabinetAccess();
    prismaMock.document.findUnique.mockResolvedValue({ validatedAt: null });

    await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_VALIDATED" }));
  });

  it("ignore le champ pour une structure : un client ne valide jamais", async () => {
    await uploadDocument(finalForm());

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });
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

    expect(result).toEqual({ success: true, documentTypeId: LOI_TYPE.id, documentVersionId: "dv-1" });
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

    expect(result).toEqual({ success: true, documentTypeId: RH_TYPE.id, documentVersionId: "dv-1" });
    expect(ingestDocumentVersion).toHaveBeenCalledTimes(1);
  });

  it("ouvre toutes les catégories à un bêta-test gratuit", async () => {
    givenMission("ESSENTIEL", true);
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    await expect(uploadDocument(uploadForm(RH_TYPE.id))).resolves.toEqual({
      success: true,
      documentTypeId: RH_TYPE.id,
      documentVersionId: "dv-1",
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

// CVS et « Autre forme de participation des usagers » (21/10/2026) : deux livrables
// distincts ; le CVS ne se déclare « Non concerné » qu'une fois la forme choisie.
const CVS_TYPE = { id: "dt-cvs", code: "L2002_CR_CVS", label: "Comptes-rendus CVS", category: "LOI_2002_2" };
const PARTICIPATION_TYPE = { id: "dt-participation", code: "QUALITE_ENQUETE_QUESTIONNAIRE", category: "QUALITE_RISQUES" };

describe("respondToMissingDocument — CVS « Non concerné »", () => {
  it("refuse sans forme de participation choisie, sans rien écrire", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(CVS_TYPE);
    prismaMock.document.findFirst.mockResolvedValue(null);

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, CVS_TYPE.id, "NOT_CONCERNED", null);

    expect(result).toMatchObject({ error: expect.stringContaining("autre forme de participation") });
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
  });

  it("accepte une fois l'enquête de satisfaction choisie : NOT_APPLICABLE, pas un document manquant", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(CVS_TYPE);
    prismaMock.document.findFirst.mockResolvedValue({ participationForm: "ENQUETE_SATISFACTION" });

    const result = await respondToMissingDocument(ESTABLISHMENT_ID, CVS_TYPE.id, "NOT_CONCERNED", null);

    expect(result).toBeNull();
    // La forme est lue pour CETTE structure, jamais pour une autre.
    expect(prismaMock.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ establishmentId: ESTABLISHMENT_ID }) })
    );
    expect(prismaMock.document.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ status: "NOT_APPLICABLE" }) })
    );
  });
});

describe("setParticipationForm — la forme choisie par la structure", () => {
  it("enregistre la forme sur la ligne « Autre forme de participation », jamais sur le CVS", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(PARTICIPATION_TYPE);

    expect(await setParticipationForm(ESTABLISHMENT_ID, "ENQUETE_SATISFACTION", "ignoré")).toBeNull();

    expect(prismaMock.documentType.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "QUALITE_ENQUETE_QUESTIONNAIRE" } })
    );
    const call = prismaMock.document.upsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    // Les versions et l'analyse existantes ne sont pas touchées : seuls ces deux champs.
    expect(call.update).toEqual({ participationForm: "ENQUETE_SATISFACTION", participationOtherLabel: null });
    expect(call.create).toMatchObject({ status: "MISSING", participationForm: "ENQUETE_SATISFACTION" });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PARTICIPATION_FORM_SET", detail: "ENQUETE_SATISFACTION" })
    );
  });

  it("refuse une forme inconnue ou un « Autre » sans précision, sans rien écrire", async () => {
    expect(await setParticipationForm(ESTABLISHMENT_ID, "CVS", null)).toMatchObject({ error: expect.any(String) });
    expect(await setParticipationForm(ESTABLISHMENT_ID, "AUTRE", "  ")).toMatchObject({ error: expect.any(String) });
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
  });

  it("propage le refus de la garde", async () => {
    requireEstablishmentAccess.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(setParticipationForm("etab-autre", "GROUPE_PAROLE", null)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prismaMock.document.upsert).not.toHaveBeenCalled();
  });
});

describe("addCriterionGuidelines — plusieurs critères en un enregistrement", () => {
  beforeEach(() => {
    requireCabinetSession.mockResolvedValue({ tenantId: "t-1", userId: "u-1", session: { user: { role: "CABINET_ADMIN" } } });
  });

  it("enregistre la même consigne sur chaque critère coché, doublons retirés", async () => {
    prismaMock.criterion.findMany.mockResolvedValue([
      { id: "c-1", code: "1.2.1" },
      { id: "c-2", code: "1.10.1" },
    ]);

    const result = await addCriterionGuidelines(["c-1", "c-2", "c-1"], "Vérifier la date de mise à jour.");

    expect(result).toEqual({ saved: 2 });
    expect(requireCabinetSession).toHaveBeenCalledWith("STRUCTURES_WRITE");
    const data = (prismaMock.criterionGuideline.createMany.mock.calls[0]?.[0] as { data: { criterionId: string; tenantId: string }[] }).data;
    expect(data.map((d) => d.criterionId)).toEqual(["c-1", "c-2"]);
    expect(data.every((d) => d.tenantId === "t-1")).toBe(true);
  });

  it("refuse une liste vide ou un critère inconnu, sans rien écrire", async () => {
    expect(await addCriterionGuidelines([], "Une consigne.")).toEqual({ error: "Cochez au moins un critère." });
    prismaMock.criterion.findMany.mockResolvedValue([{ id: "c-1", code: "1.2.1" }]);
    expect(await addCriterionGuidelines(["c-1", "inconnu"], "Une consigne.")).toMatchObject({ error: expect.any(String) });
    expect(prismaMock.criterionGuideline.createMany).not.toHaveBeenCalled();
  });
});

// La génération est désormais une seule porte (N8) : generateDocumentDraft délègue à
// generateCorrectionProposal, dont le droit (correctionScope, D11, D13), la garde et
// le journal sont testés dans correction-proposal.test.ts.
describe("generateDocumentDraft — délégation", () => {
  it("passe la main à la mise en conformité structurée", async () => {
    generateCorrectionProposal.mockResolvedValue(null);
    expect(await generateDocumentDraft("dv-1", "modele")).toBeNull();
    expect(generateCorrectionProposal).toHaveBeenCalledWith("dv-1", "modele");
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

// Ce que la STRUCTURE fait → le CABINET (16/10/2026). Le chaînon qui manquait : un
// dépôt, une acceptation et un « je ne l'ai pas » ne se voyaient qu'en rouvrant la
// fiche, donc jamais le jour même. Ce qui est protégé ici : le bon événement au bon
// moment, le libellé du TYPE et jamais le nom du fichier, et le silence partout où
// rien ne demande de travail au cabinet.
describe("uploadDocument — le cabinet est prévenu du dépôt de la structure", () => {
  it("annonce un DÉPÔT, avec le libellé du type de document", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(notifyStructureActivity).toHaveBeenCalledWith({
      establishmentId: ESTABLISHMENT_ID,
      documentLabel: LOI_TYPE.label,
      kind: "DEPOSIT",
    });
    // Preuve par l'absurde du libellé : le formulaire porte « doc.pdf », et ce nom
    // saisi librement peut nommer une personne. Il ne sort jamais d'ici.
    const call = notifyStructureActivity.mock.calls[0]?.[0] as { documentLabel: string };
    expect(call.documentLabel).not.toContain("doc.pdf");
    // Ni l'annonce client (aucune validation n'a été posée), ni un second événement.
    expect(notifyDocumentAvailable).not.toHaveBeenCalled();
  });

  it("un dépôt du CABINET ne s'annonce pas au cabinet", async () => {
    asCabinet();
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);
    prismaMock.document.findUnique.mockResolvedValue({ validatedAt: null });

    await uploadDocument(uploadForm(LOI_TYPE.id));

    expect(notifyStructureActivity).not.toHaveBeenCalled();
  });
});

describe("respondToMissingDocument — ce qui demande du travail au cabinet", () => {
  it("« Je ne l'ai pas » prévient le cabinet : le document est à PRODUIRE", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    await respondToMissingDocument(ESTABLISHMENT_ID, LOI_TYPE.id, "DONT_HAVE", null);

    expect(notifyStructureActivity).toHaveBeenCalledWith({
      establishmentId: ESTABLISHMENT_ID,
      documentLabel: LOI_TYPE.label,
      kind: "DECLARED_MISSING",
    });
  });

  it("« il arrive » ne prévient personne : la structure s'en occupe", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(LOI_TYPE);

    expect(await respondToMissingDocument(ESTABLISHMENT_ID, LOI_TYPE.id, "WILL_PROVIDE", null)).toBeNull();

    expect(notifyStructureActivity).not.toHaveBeenCalled();
  });

  it("« non concerné » ne prévient personne : le document quitte la liste, sans commande", async () => {
    givenMission("EXCELLENCE");
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    expect(await respondToMissingDocument(ESTABLISHMENT_ID, RH_TYPE.id, "NOT_CONCERNED", null)).toBeNull();

    expect(notifyStructureActivity).not.toHaveBeenCalled();
  });

  it("une réponse refusée (hors périmètre, garde) ne prévient personne", async () => {
    givenMission("ESSENTIEL");
    prismaMock.documentType.findUnique.mockResolvedValue(RH_TYPE);

    expect(await respondToMissingDocument(ESTABLISHMENT_ID, RH_TYPE.id, "DONT_HAVE", null)).toEqual({
      error: "Ce document n'entre pas dans le périmètre de l'offre souscrite pour cet établissement.",
    });
    expect(notifyStructureActivity).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L'APERÇU N'EST PAS QU'UN BOUTON (20/10/2026).
//
// « Mes documents » propose désormais « Voir », et la structure reçoit dans sa page
// l'historique complet des versions — donc leurs identifiants. Un brouillon produit
// par EODA et pas encore validé ne doit donc pas être servi, même si quelqu'un
// construit l'identifiant à la main : la règle vit dans `isVersionVisibleToClient`
// (deliverables-service) et les DEUX portes qui servent les octets l'appliquent.
describe("getDocumentPreviewData — ce que la structure a le droit d'ouvrir", () => {
  function versionRow(role: string, validatedAt: Date | null) {
    return {
      id: "v-1",
      originalFilename: "document.docx",
      fileStorageKey: "storage-key",
      extractedText: null,
      uploadedBy: { role },
      document: {
        establishmentId: ESTABLISHMENT_ID,
        validatedAt,
        documentType: { code: "L2002_LIVRET_ACCUEIL" },
      },
    };
  }

  beforeEach(() => {
    prismaMock.documentVersion.findUnique.mockReset();
    tryEstablishmentAccess.mockReset();
    tryEstablishmentAccess.mockResolvedValue({ isClient: true, userId: "u-1", session: { user: {} } });
  });

  it("refuse le brouillon du cabinet tant que le document n'est pas validé", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(versionRow("CABINET_ADMIN", null));

    await expect(getDocumentPreviewData("v-1")).resolves.toBeNull();
  });

  it("sert la pièce déposée par la structure, et celle du cabinet une fois validée", async () => {
    prismaMock.documentVersion.findUnique.mockResolvedValue(versionRow("CLIENT_USER", null));
    await expect(getDocumentPreviewData("v-1")).resolves.toMatchObject({ kind: "document" });

    prismaMock.documentVersion.findUnique.mockResolvedValue(versionRow("CABINET_ADMIN", new Date()));
    await expect(getDocumentPreviewData("v-1")).resolves.toMatchObject({ kind: "document" });
  });
});
