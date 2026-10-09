import { beforeEach, describe, expect, it, vi } from "vitest";

// Faits de la liste des structures et de l'accueil : sous la garde cabinet, avec les
// lectures groupées bornées au tenant (couverture loi 2002-2) ou aux fiches déjà
// bornées au tenant (dernière activité). Sans garde, rien n'est lu.

class RedirectError extends Error {}

const prismaMock = {
  auditLogEntry: { groupBy: vi.fn() },
  document: { groupBy: vi.fn() },
  documentType: { count: vi.fn() },
};
const requireCabinetSession = vi.fn();
const listEstablishments = vi.fn();
const getEstablishmentIdsWithUnansweredMessage = vi.fn();
const countDocumentsAwaitingReviewByEstablishment = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/guards", () => ({ requireCabinetSession: () => requireCabinetSession() }));
vi.mock("@/lib/actions/establishment", () => ({ listEstablishments: () => listEstablishments() }));
vi.mock("@/lib/actions/message", () => ({
  getEstablishmentIdsWithUnansweredMessage: () => getEstablishmentIdsWithUnansweredMessage(),
}));
vi.mock("@/lib/actions/review-queue", () => ({
  countDocumentsAwaitingReviewByEstablishment: () => countDocumentsAwaitingReviewByEstablishment(),
}));

const { getStructuresOverview } = await import("./structures-overview");

const ESTABLISHMENT = {
  id: "e1",
  name: "SAD Les Glycines (fictif)",
  type: "SAD_AIDE",
  hasEvaluationTargetDate: new Date("2027-01-03"),
  prospect: { status: "SIGNE" },
  mission: {
    closedAt: null,
    gratuit: true,
    fondationsStartDate: new Date("2026-09-01"),
    fondationsEndDate: null,
    deploiementStartDate: null,
    deploiementEndDate: null,
    consolidationStartDate: null,
    consolidationEndDate: null,
    preparationFinaleStartDate: null,
    preparationFinaleEndDate: null,
    formule: "EXCELLENCE",
    _count: { itemStatuses: 0 },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetSession.mockResolvedValue({ userId: "u1", tenantId: "tenant-1", role: "CABINET_EVALUATOR" });
  listEstablishments.mockResolvedValue([ESTABLISHMENT, { ...ESTABLISHMENT, id: "e2", mission: null, prospect: null }]);
  getEstablishmentIdsWithUnansweredMessage.mockResolvedValue(new Set(["e2"]));
  countDocumentsAwaitingReviewByEstablishment.mockResolvedValue(new Map([["e1", 2]]));
  prismaMock.document.groupBy.mockResolvedValue([{ establishmentId: "e1", _count: { _all: 4 } }]);
  prismaMock.documentType.count.mockResolvedValue(7);
  prismaMock.auditLogEntry.groupBy.mockResolvedValue([
    { establishmentId: "e1", _max: { occurredAt: new Date("2026-10-08") } },
  ]);
});

describe("getStructuresOverview", () => {
  it("assemble les faits dérivés de chaque structure", async () => {
    const { rows, portfolio } = await getStructuresOverview();

    expect(rows[0]).toEqual({
      id: "e1",
      name: "SAD Les Glycines (fictif)",
      type: "SAD_AIDE",
      stage: "EN_COURS",
      isBeta: true,
      hasEvaluationTargetDate: new Date("2027-01-03"),
      lastActivityAt: new Date("2026-10-08"),
      documentsAwaitingReview: 2,
      hasUnansweredMessage: false,
      loi2002Deposited: 4,
      loi2002Total: 7,
    });
    expect(rows[1]).toMatchObject({
      id: "e2",
      stage: null,
      lastActivityAt: null,
      documentsAwaitingReview: 0,
      hasUnansweredMessage: true,
      loi2002Deposited: 0,
    });
    expect(portfolio).toHaveLength(2);
  });

  it("borne les lectures groupées au tenant de la garde", async () => {
    await getStructuresOverview();
    expect(prismaMock.document.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ establishment: { tenantId: "tenant-1" } }),
      })
    );
    // Le journal n'a pas de relation : filtré par les fiches déjà bornées au tenant.
    expect(prismaMock.auditLogEntry.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { establishmentId: { in: ["e1", "e2"] } } })
    );
  });

  it("aucune fiche : pas de lecture du journal", async () => {
    listEstablishments.mockResolvedValue([]);
    await expect(getStructuresOverview()).resolves.toEqual({ rows: [], portfolio: [] });
    expect(prismaMock.auditLogEntry.groupBy).not.toHaveBeenCalled();
  });

  it("non authentifié ou client : la garde refuse, rien n'est lu", async () => {
    requireCabinetSession.mockRejectedValue(new RedirectError());
    await expect(getStructuresOverview()).rejects.toBeInstanceOf(RedirectError);
    expect(listEstablishments).not.toHaveBeenCalled();
    expect(prismaMock.document.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.auditLogEntry.groupBy).not.toHaveBeenCalled();
  });
});
