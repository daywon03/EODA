import { beforeEach, describe, expect, it, vi } from "vitest";

// File « À relire » côté cabinet : le compteur, la liste et l'élément ouvert sont
// filtrés par le tenant DE LA GARDE, sans condition (fail-closed), et rien ne
// s'exécute sans elle. Un élément demandé par l'URL hors du tenant → notFound().

class RedirectError extends Error {}
class NotFoundError extends Error {}

const prismaMock = {
  documentVersion: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  document: { groupBy: vi.fn() },
};
const requireCabinetSession = vi.fn();
const requireEstablishmentInTenant = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  Prisma: { AnyNull: "AnyNull" },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: () => requireCabinetSession(),
  requireEstablishmentInTenant: (id: string) => requireEstablishmentInTenant(id),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));

const {
  countDocumentsAwaitingReview,
  countDocumentsAwaitingReviewByEstablishment,
  getEstablishmentReviewSummary,
  getReviewQueueEntry,
  listDocumentsAwaitingReview,
} = await import("./review-queue");

const EXPECTED_WHERE = {
  analysisResultJson: { not: "AnyNull" },
  analysisReviewedAt: null,
  currentForDocument: { isNot: null },
  document: { establishment: { tenantId: "tenant-1" } },
};

const ANALYSIS = {
  elementsPresents: [],
  elementsManquants: ["Numéro FINESS absent"],
  suggestionsCorrection: [],
  sembleConforme: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetSession.mockResolvedValue({ userId: "u1", tenantId: "tenant-1", role: "CABINET_EVALUATOR" });
  requireEstablishmentInTenant.mockImplementation(async (id: string) => {
    if (id !== "e1") throw new NotFoundError();
    return { userId: "u1", tenantId: "tenant-1", role: "CABINET_EVALUATOR", establishmentId: id };
  });
  prismaMock.documentVersion.count.mockResolvedValue(0);
  prismaMock.documentVersion.findMany.mockResolvedValue([]);
  prismaMock.documentVersion.findFirst.mockResolvedValue(null);
  prismaMock.document.groupBy.mockResolvedValue([]);
});

describe("countDocumentsAwaitingReview", () => {
  it("compte les analyses non relues des versions courantes du tenant de l'appelant", async () => {
    prismaMock.documentVersion.count.mockResolvedValue(4);
    await expect(countDocumentsAwaitingReview()).resolves.toBe(4);
    expect(prismaMock.documentVersion.count).toHaveBeenCalledWith({ where: EXPECTED_WHERE });
  });

  it("non authentifié ou client : la garde refuse, rien n'est lu", async () => {
    requireCabinetSession.mockRejectedValue(new RedirectError());
    await expect(countDocumentsAwaitingReview()).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.documentVersion.count).not.toHaveBeenCalled();
  });
});

describe("countDocumentsAwaitingReviewByEstablishment", () => {
  it("regroupe la file par structure, dans le tenant de la garde", async () => {
    prismaMock.document.groupBy.mockResolvedValue([
      { establishmentId: "e1", _count: { _all: 2 } },
      { establishmentId: "e2", _count: { _all: 1 } },
    ]);
    const counts = await countDocumentsAwaitingReviewByEstablishment();
    expect(Object.fromEntries(counts)).toEqual({ e1: 2, e2: 1 });
    expect(prismaMock.document.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["establishmentId"],
        where: {
          establishment: { tenantId: "tenant-1" },
          currentVersion: { is: { analysisResultJson: { not: "AnyNull" }, analysisReviewedAt: null } },
        },
      })
    );
  });

  it("sans garde valide, aucune lecture", async () => {
    requireCabinetSession.mockRejectedValue(new RedirectError());
    await expect(countDocumentsAwaitingReviewByEstablishment()).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.document.groupBy).not.toHaveBeenCalled();
  });
});

describe("listDocumentsAwaitingReview", () => {
  it("liste la file du tenant, convertie, comptée et du plus ancien au plus récent", async () => {
    prismaMock.documentVersion.findMany.mockResolvedValue([
      {
        id: "v2",
        versionNumber: 1,
        uploadedAt: new Date("2026-10-02"),
        originalFilename: "projet.docx",
        analysisResultJson: null,
        _count: { criterionSuggestions: 0 },
        document: { documentType: null, establishment: { id: "e2", name: "SAD Le Moulin (fictif)" } },
      },
      {
        id: "v1",
        versionNumber: 3,
        uploadedAt: new Date("2026-09-20"),
        originalFilename: "livret.pdf",
        analysisResultJson: ANALYSIS,
        _count: { criterionSuggestions: 2 },
        document: {
          documentType: { label: "Livret d'accueil" },
          establishment: { id: "e1", name: "SAD Les Glycines (fictif)" },
        },
      },
    ]);
    prismaMock.documentVersion.count.mockResolvedValue(2);

    const { items, totalCount } = await listDocumentsAwaitingReview();

    expect(totalCount).toBe(2);
    expect(items.map((i) => [i.versionId, i.documentLabel, i.href, i.proposalCount])).toEqual([
      ["v1", "Livret d'accueil", "/dashboard/cabinet/a-relire?v=v1", 3],
      ["v2", "projet.docx", "/dashboard/cabinet/a-relire?v=v2", 0],
    ]);
    expect(prismaMock.documentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: EXPECTED_WHERE, orderBy: { uploadedAt: "asc" } })
    );
  });

  it("file vide : liste vide, pas d'erreur", async () => {
    await expect(listDocumentsAwaitingReview()).resolves.toEqual({ items: [], totalCount: 0 });
  });

  it("sans garde valide, aucune lecture", async () => {
    requireCabinetSession.mockRejectedValue(new RedirectError());
    await expect(listDocumentsAwaitingReview()).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.documentVersion.findMany).not.toHaveBeenCalled();
  });
});

describe("getReviewQueueEntry", () => {
  const version = {
    id: "v1",
    versionNumber: 2,
    uploadedAt: new Date("2026-10-01"),
    originalFilename: "plan.pdf",
    analysisResultJson: ANALYSIS,
    analysisReviewedAt: null,
    currentForDocument: { id: "d1" },
    criterionSuggestions: [
      {
        id: "s1",
        status: "PENDING",
        justification: "page 4",
        criterion: { code: "3.6.2", label: "Sécurisation du circuit du médicament", requirementLevel: "STANDARD" },
      },
    ],
    document: {
      documentType: { label: "Procédure circuit du médicament" },
      establishment: { id: "e1", name: "SAD Les Glycines (fictif)", type: "SAD_MIXTE" },
    },
  };

  it("cherche la version DANS le tenant de la garde et la met en forme", async () => {
    prismaMock.documentVersion.findFirst.mockResolvedValue(version);
    const entry = await getReviewQueueEntry("v1");

    expect(prismaMock.documentVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "v1", document: { establishment: { tenantId: "tenant-1" } } } })
    );
    expect(entry).toMatchObject({
      versionId: "v1",
      establishmentId: "e1",
      documentLabel: "Procédure circuit du médicament",
      versionLabel: "Version 2",
      isCurrent: true,
      hasReadableAnalysis: true,
    });
    // 3.6.2 est impératif pour un SAD mixte : résolu selon le profil réel.
    expect(entry.proposals.criteria).toEqual([
      expect.objectContaining({ id: "s1", status: "PENDING", criterionCode: "3.6.2", isImperative: true }),
    ]);
    expect(entry.proposals.findings).toEqual([{ kind: "MISSING", key: "m0", text: "Numéro FINESS absent" }]);
  });

  it("version remplacée, analyse illisible : dit tel quel", async () => {
    prismaMock.documentVersion.findFirst.mockResolvedValue({
      ...version,
      currentForDocument: null,
      analysisResultJson: {},
      criterionSuggestions: [],
    });
    const entry = await getReviewQueueEntry("v1");
    expect(entry.isCurrent).toBe(false);
    expect(entry.hasReadableAnalysis).toBe(false);
    expect(entry.proposals).toEqual({ criteria: [], findings: [] });
  });

  it("hors du tenant (ou inexistante) : notFound(), sans rien révéler", async () => {
    await expect(getReviewQueueEntry("v-autre-tenant")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("identifiant invalide : refusé avant la base", async () => {
    await expect(getReviewQueueEntry("x".repeat(65))).rejects.toBeInstanceOf(NotFoundError);
    await expect(getReviewQueueEntry("")).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.documentVersion.findFirst).not.toHaveBeenCalled();
  });

  it("non authentifié ou client : la garde refuse, rien n'est lu", async () => {
    requireCabinetSession.mockRejectedValue(new RedirectError());
    await expect(getReviewQueueEntry("v1")).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.documentVersion.findFirst).not.toHaveBeenCalled();
  });
});

describe("getEstablishmentReviewSummary — en-tête de la fiche", () => {
  it("compte la file de CETTE structure et désigne la plus ancienne version", async () => {
    prismaMock.documentVersion.count.mockResolvedValue(2);
    prismaMock.documentVersion.findFirst.mockResolvedValue({ id: "v-old" });
    await expect(getEstablishmentReviewSummary("e1")).resolves.toEqual({ count: 2, oldestVersionId: "v-old" });
    const where = { ...EXPECTED_WHERE, document: { establishmentId: "e1", establishment: { tenantId: "tenant-1" } } };
    expect(prismaMock.documentVersion.count).toHaveBeenCalledWith({ where });
    expect(prismaMock.documentVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where, orderBy: { uploadedAt: "asc" } })
    );
  });

  it("rien à relire : aucune version désignée", async () => {
    await expect(getEstablishmentReviewSummary("e1")).resolves.toEqual({ count: 0, oldestVersionId: null });
  });

  it("structure hors tenant : notFound, rien n'est lu", async () => {
    await expect(getEstablishmentReviewSummary("autre")).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.documentVersion.count).not.toHaveBeenCalled();
  });

  it("non authentifié : la garde refuse", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new RedirectError());
    await expect(getEstablishmentReviewSummary("e1")).rejects.toBeInstanceOf(RedirectError);
  });
});
