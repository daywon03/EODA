import { beforeEach, describe, expect, it, vi } from "vitest";

// Matrice documents → critères (N4) : CABINET_ADMIN seul ; l'écriture ne porte que
// sur les critères PROPOSÉS pour le type et présents en base ; une suggestion promue
// doit appartenir au cabinet de l'appelant (IDOR) et être confirmée.

const prismaMock = {
  criterion: { findMany: vi.fn(), findUnique: vi.fn() },
  documentType: { findMany: vi.fn(), findUnique: vi.fn() },
  documentTypeCriterion: { findMany: vi.fn(), findUnique: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  documentCriterionSuggestion: { findMany: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
};
const requireCabinetAdminSession = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
// Cache du référentiel : transparent ici (aucun cache Next hors requête).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: <T>(fn: T) => fn }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
const requireCabinetSession = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: () => requireCabinetAdminSession(),
  requireCabinetSession: (need: string) => requireCabinetSession(need),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const {
  getMatrixReview,
  validateMatrixForDocumentType,
  promoteCriterionSuggestion,
  addManualMatrixLinks,
  unlinkCriterionFromDocumentType,
  getDocumentTypeLinks,
  listLinkableDocumentTypes,
} = await import("./criterion-matrix");

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({
    userId: "u-admin",
    tenantId: "t-1",
    session: { user: { role: "CABINET_ADMIN" } },
  });
  prismaMock.$transaction.mockResolvedValue([]);
});

describe("garde", () => {
  it("non-admin (évaluatrice, client, non authentifié) : refusé avant toute lecture", async () => {
    requireCabinetAdminSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(getMatrixReview()).rejects.toThrow("REDIRECT");
    await expect(validateMatrixForDocumentType(form({ documentTypeCode: "L2002_DIPC" }))).rejects.toThrow("REDIRECT");
    await expect(promoteCriterionSuggestion(form({ suggestionId: "s" }))).rejects.toThrow("REDIRECT");
    expect(prismaMock.criterion.findMany).not.toHaveBeenCalled();
  });
});

describe("getMatrixReview", () => {
  it("borne les suggestions confirmées au cabinet et écarte celles déjà rattachées", async () => {
    prismaMock.criterion.findMany.mockResolvedValue([{ code: "1.2.1", label: "Intitulé 1.2.1" }]);
    prismaMock.documentType.findMany.mockResolvedValue([{ code: "L2002_DIPC", label: "DIPC" }]);
    prismaMock.documentTypeCriterion.findMany.mockResolvedValue([
      { documentType: { code: "L2002_DIPC" }, criterion: { code: "1.2.1" } },
    ]);
    prismaMock.documentCriterionSuggestion.findMany.mockResolvedValue([
      { id: "s1", criterion: { code: "1.2.1", label: "x" }, document: { documentType: { code: "L2002_DIPC", label: "DIPC" } } },
      { id: "s2", criterion: { code: "3.1.1", label: "y" }, document: { documentType: { code: "L2002_DIPC", label: "DIPC" } } },
      { id: "s3", criterion: { code: "3.1.1", label: "y" }, document: { documentType: { code: "L2002_DIPC", label: "DIPC" } } },
    ]);

    const review = await getMatrixReview();

    expect(prismaMock.documentCriterionSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ document: expect.objectContaining({ establishment: { tenantId: "t-1" } }) }),
      })
    );
    expect(review.promotable.map((p) => p.suggestionId)).toEqual(["s2"]);
    expect(review.groups.find((g) => g.documentTypeCode === "L2002_DIPC")?.rows).toEqual([
      expect.objectContaining({ criterionCode: "1.2.1", linked: true }),
    ]);
  });
});

describe("validateMatrixForDocumentType", () => {
  it("n'écrit que des critères proposés pour ce type ; retire un proposé décoché ; journalise sans texte libre", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "type-dipc" });
    // Proposés ET en base : 1.2.1, 1.2.2 (les autres codes proposés sont hors base).
    prismaMock.criterion.findMany.mockResolvedValue([
      { id: "c-121", code: "1.2.1" },
      { id: "c-122", code: "1.2.2" },
    ]);
    prismaMock.documentTypeCriterion.findMany.mockResolvedValue([{ criterion: { code: "1.2.2" } }]);

    const result = await validateMatrixForDocumentType(
      form({ documentTypeCode: "L2002_DIPC", criterionCode: ["1.2.1", "9.9.9"] })
    );

    expect(result).toBeNull();
    expect(prismaMock.documentTypeCriterion.createMany).toHaveBeenCalledWith({
      data: [{ documentTypeId: "type-dipc", criterionId: "c-121" }],
      skipDuplicates: true,
    });
    expect(prismaMock.documentTypeCriterion.deleteMany).toHaveBeenCalledWith({
      where: { documentTypeId: "type-dipc", criterionId: { in: ["c-122"] } },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_TYPE_CRITERIA_UPDATED", detail: "L2002_DIPC · +1 −1" })
    );
  });

  it("type manquant : refus ; type inconnu : introuvable", async () => {
    expect(await validateMatrixForDocumentType(form({}))).toEqual({ error: "Type de document manquant." });
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(validateMatrixForDocumentType(form({ documentTypeCode: "X" }))).rejects.toThrow("NOT_FOUND");
  });
});

describe("promoteCriterionSuggestion", () => {
  const confirmed = {
    id: "s1",
    status: "CONFIRMED",
    criterionId: "c-1",
    criterion: { code: "3.1.1" },
    document: { documentTypeId: "type-1", documentType: { code: "T1" } },
  };

  it("promeut une suggestion confirmée de son cabinet", async () => {
    prismaMock.documentCriterionSuggestion.findFirst.mockResolvedValue(confirmed);
    prismaMock.documentTypeCriterion.findUnique.mockResolvedValue(null);

    expect(await promoteCriterionSuggestion(form({ suggestionId: "s1" }))).toBeNull();
    expect(prismaMock.documentCriterionSuggestion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1", document: { establishment: { tenantId: "t-1" } } } })
    );
    expect(prismaMock.documentTypeCriterion.create).toHaveBeenCalledWith({
      data: { documentTypeId: "type-1", criterionId: "c-1" },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_TYPE_CRITERION_PROMOTED", detail: "T1 · 3.1.1" })
    );
  });

  it("suggestion d'un autre cabinet : introuvable", async () => {
    prismaMock.documentCriterionSuggestion.findFirst.mockResolvedValue(null);
    await expect(promoteCriterionSuggestion(form({ suggestionId: "autre" }))).rejects.toThrow("NOT_FOUND");
  });

  it("suggestion non confirmée ou déjà rattachée : refus, rien n'est écrit", async () => {
    prismaMock.documentCriterionSuggestion.findFirst.mockResolvedValue({ ...confirmed, status: "PENDING" });
    prismaMock.documentTypeCriterion.findUnique.mockResolvedValue(null);
    expect(await promoteCriterionSuggestion(form({ suggestionId: "s1" }))).toHaveProperty("error");

    prismaMock.documentCriterionSuggestion.findFirst.mockResolvedValue(confirmed);
    prismaMock.documentTypeCriterion.findUnique.mockResolvedValue({ criterionId: "c-1" });
    expect(await promoteCriterionSuggestion(form({ suggestionId: "s1" }))).toHaveProperty("error");

    expect(await promoteCriterionSuggestion(form({}))).toEqual({ error: "Suggestion manquante." });
    expect(prismaMock.documentTypeCriterion.create).not.toHaveBeenCalled();
  });
});

// Rattachement à la main (call du 21/10/2026) : n'importe quel critère du référentiel
// en base, à n'importe quel type — l'administratrice seule, codes recalculés.
describe("addManualMatrixLinks", () => {
  beforeEach(() => {
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-enquete" });
    prismaMock.documentTypeCriterion.findMany.mockResolvedValue([{ criterion: { code: "1.1.1" } }]);
    prismaMock.documentTypeCriterion.createMany.mockResolvedValue({ count: 2 });
  });

  it("rattache des critères NON proposés pour ce type, ignore ceux déjà rattachés, journalise les codes", async () => {
    prismaMock.criterion.findMany.mockResolvedValue([
      { id: "c-131", code: "1.3.1" },
      { id: "c-151", code: "1.5.1" },
      { id: "c-111", code: "1.1.1" },
    ]);
    const result = await addManualMatrixLinks("QUALITE_ENQUETE_QUESTIONNAIRE", ["1.3.1", "1.5.1", "1.1.1"]);
    expect(result).toEqual({ added: 2, alreadyLinked: 1 });
    expect(prismaMock.documentTypeCriterion.createMany).toHaveBeenCalledWith({
      data: [
        { documentTypeId: "dt-enquete", criterionId: "c-131" },
        { documentTypeId: "dt-enquete", criterionId: "c-151" },
      ],
      skipDuplicates: true,
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_TYPE_CRITERIA_UPDATED", detail: expect.stringContaining("ajout manuel +2") })
    );
  });

  it("refuse un code inconnu du référentiel ou une liste vide, sans rien écrire", async () => {
    prismaMock.criterion.findMany.mockResolvedValue([{ id: "c-131", code: "1.3.1" }]);
    expect(await addManualMatrixLinks("QUALITE_ENQUETE_QUESTIONNAIRE", ["1.3.1", "9.9.9"])).toEqual({
      error: "Critère absent des grilles SAD : 9.9.9. Vérifiez le code ou son périmètre (un critère « Établissement » ne s'applique pas à un SAD).",
    });
    expect(await addManualMatrixLinks("QUALITE_ENQUETE_QUESTIONNAIRE", [])).toEqual({ error: "Cochez au moins un critère." });
    expect(prismaMock.documentTypeCriterion.createMany).not.toHaveBeenCalled();
  });

  it("type inconnu : notFound ; non-admin : refusé avant toute lecture", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(addManualMatrixLinks("INCONNU", ["1.3.1"])).rejects.toThrow("NOT_FOUND");
    requireCabinetAdminSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(addManualMatrixLinks("QUALITE_ENQUETE_QUESTIONNAIRE", ["1.3.1"])).rejects.toThrow("REDIRECT");
    await expect(unlinkCriterionFromDocumentType("QUALITE_ENQUETE_QUESTIONNAIRE", "1.3.1")).rejects.toThrow("REDIRECT");
    expect(prismaMock.documentTypeCriterion.delete).not.toHaveBeenCalled();
  });
});

describe("unlinkCriterionFromDocumentType — décocher depuis n'importe quel menu", () => {
  beforeEach(() => {
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-enquete", archivedAt: null });
    prismaMock.criterion.findUnique.mockResolvedValue({ id: "c-131" });
    prismaMock.documentTypeCriterion.findUnique.mockResolvedValue({ criterionId: "c-131" });
  });

  it("retire un rattachement fait à la main, et le journalise sans libellé", async () => {
    expect(await unlinkCriterionFromDocumentType("QUALITE_ENQUETE_QUESTIONNAIRE", "1.3.1")).toBeNull();
    expect(prismaMock.documentTypeCriterion.delete).toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_TYPE_CRITERIA_UPDATED", detail: "QUALITE_ENQUETE_QUESTIONNAIRE · retrait manuel 1.3.1" })
    );
  });

  it("décocher un critère PROPOSÉ le refuse — même écriture que la carte du type", async () => {
    // 3.14.2 est proposé pour l'enquête dans la proposition embarquée.
    expect(await unlinkCriterionFromDocumentType("QUALITE_ENQUETE_QUESTIONNAIRE", "3.14.2")).toBeNull();
    expect(prismaMock.documentTypeCriterion.delete).toHaveBeenCalledWith({
      where: { documentTypeId_criterionId: { documentTypeId: "dt-enquete", criterionId: "c-131" } },
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ detail: "QUALITE_ENQUETE_QUESTIONNAIRE · proposition refusée 3.14.2" })
    );
  });

  it("refuse ce qui n'est pas rattaché, sans rien écrire", async () => {
    prismaMock.documentTypeCriterion.findUnique.mockResolvedValue(null);
    expect(await unlinkCriterionFromDocumentType("QUALITE_ENQUETE_QUESTIONNAIRE", "1.3.1")).toMatchObject({
      error: expect.stringContaining("pas rattaché"),
    });
    expect(prismaMock.documentTypeCriterion.delete).not.toHaveBeenCalled();
  });

  it("type inconnu, archivé ou critère inconnu : notFound", async () => {
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-x", archivedAt: new Date() });
    await expect(unlinkCriterionFromDocumentType("EODA_X", "1.3.1")).rejects.toThrow("NOT_FOUND");
    prismaMock.documentType.findUnique.mockResolvedValue(null);
    await expect(unlinkCriterionFromDocumentType("INCONNU", "1.3.1")).rejects.toThrow("NOT_FOUND");
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-enquete", archivedAt: null });
    prismaMock.criterion.findUnique.mockResolvedValue(null);
    await expect(unlinkCriterionFromDocumentType("QUALITE_ENQUETE_QUESTIONNAIRE", "9.9.9")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.documentTypeCriterion.delete).not.toHaveBeenCalled();
  });
});

describe("lectures de la fiche document et de la page Critères (09/11/2026)", () => {
  it("getDocumentTypeLinks : lisible par tout le cabinet qui lit les structures, avec la provenance", async () => {
    requireCabinetSession.mockResolvedValue({ userId: "u-eval", tenantId: "t-1", role: "CABINET_EVALUATOR" });
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-enquete", archivedAt: null });
    prismaMock.documentTypeCriterion.findMany.mockResolvedValue([
      { criterion: { code: "3.14.2", label: "Crise" } },
      { criterion: { code: "1.3.1", label: "Participation" } },
    ]);
    expect(await getDocumentTypeLinks("QUALITE_ENQUETE_QUESTIONNAIRE")).toEqual([
      { code: "1.3.1", label: "Participation", proposed: false },
      { code: "3.14.2", label: "Crise", proposed: true },
    ]);
    expect(requireCabinetSession).toHaveBeenCalledWith("STRUCTURES_READ");
  });

  it("getDocumentTypeLinks : commerciale ou non connecté refusés avant toute lecture ; type archivé = notFound", async () => {
    requireCabinetSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(getDocumentTypeLinks("QUALITE_ENQUETE_QUESTIONNAIRE")).rejects.toThrow("REDIRECT");
    expect(prismaMock.documentType.findUnique).not.toHaveBeenCalled();
    requireCabinetSession.mockResolvedValue({ userId: "u-eval", tenantId: "t-1", role: "CABINET_EVALUATOR" });
    prismaMock.documentType.findUnique.mockResolvedValue({ id: "dt-x", archivedAt: new Date() });
    await expect(getDocumentTypeLinks("EODA_X")).rejects.toThrow("NOT_FOUND");
  });

  it("listLinkableDocumentTypes : administration seule, lignes en service seulement, par intitulé", async () => {
    prismaMock.documentType.findMany.mockResolvedValue([
      { id: "dt-b", code: "B", label: "Registre des plaintes" },
      { id: "dt-a", code: "A", label: "Affichage obligatoire" },
    ]);
    expect(await listLinkableDocumentTypes()).toEqual([
      { id: "dt-a", code: "A", label: "Affichage obligatoire" },
      { id: "dt-b", code: "B", label: "Registre des plaintes" },
    ]);
    expect(prismaMock.documentType.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { archivedAt: null } }));
    requireCabinetAdminSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(listLinkableDocumentTypes()).rejects.toThrow("REDIRECT");
  });
});
