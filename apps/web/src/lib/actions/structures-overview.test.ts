import { beforeEach, describe, expect, it, vi } from "vitest";

// Faits de la liste des structures et de l'accueil : sous la garde cabinet, avec les
// lectures groupées bornées au tenant (couverture loi 2002-2) ou aux fiches déjà
// bornées au tenant (dernière activité). Sans garde, rien n'est lu.

class RedirectError extends Error {}

const prismaMock = {
  auditLogEntry: { groupBy: vi.fn() },
  establishmentUser: { findMany: vi.fn() },
  document: { groupBy: vi.fn() },
  documentType: { count: vi.fn() },
  mission: { findMany: vi.fn() },
};
const readCriteriaProof = vi.fn();
const requireCabinetSession = vi.fn();
const listEstablishments = vi.fn();
const getEstablishmentIdsWithUnansweredMessage = vi.fn();
const countDocumentsAwaitingReviewByEstablishment = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: () => requireCabinetSession(),
  structureScopeWhere: (context: { tenantId: string }) => ({ tenantId: context.tenantId }),
}));
vi.mock("@/lib/actions/establishment", () => ({ listEstablishments: () => listEstablishments() }));
vi.mock("@/lib/actions/message", () => ({
  getEstablishmentIdsWithUnansweredMessage: () => getEstablishmentIdsWithUnansweredMessage(),
}));
vi.mock("@/lib/db/read-criteria-proof", () => ({
  readCriteriaProof: (...args: unknown[]) => readCriteriaProof(...args),
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
  prismaMock.mission.findMany.mockResolvedValue([{ establishmentId: "e1", supportMode: "AUTONOMIE" }]);
  readCriteriaProof.mockResolvedValue(
    new Map([
      [
        "e1",
        [
          { isImperative: true, status: "PROUVE" },
          { isImperative: true, status: "EN_PARTIE" },
          { isImperative: false, status: "PROUVE" },
        ],
      ],
    ])
  );
  prismaMock.establishmentUser.findMany.mockResolvedValue([{ establishmentId: "e1", userId: "client-1" }]);
  prismaMock.auditLogEntry.groupBy.mockResolvedValue([
    { establishmentId: "e1", actorUserId: "client-1", _max: { occurredAt: new Date("2026-10-08") } },
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
      imperatives: { proven: 1, total: 2 },
    });
    // Mode de la mission transmis à la dérivation ; sans mission, la règle stricte.
    expect(readCriteriaProof).toHaveBeenCalledWith([
      { id: "e1", type: "SAD_AIDE", mode: "AUTONOMIE" },
      expect.objectContaining({ id: "e2", mode: "ACCOMPAGNE" }),
    ]);
    expect(rows[1]).toMatchObject({
      imperatives: { proven: 0, total: 0 },
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
    expect(prismaMock.establishmentUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { establishmentId: { in: ["e1", "e2"] }, user: { role: "CLIENT_USER" } },
      })
    );
    expect(prismaMock.auditLogEntry.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["establishmentId", "actorUserId"],
        where: { establishmentId: { in: ["e1", "e2"] }, actorUserId: { in: ["client-1"] } },
      })
    );
  });

  it("dernière activité : seules les actions de la structure comptent, pas les consultations du cabinet", async () => {
    // Une entrée d'un compte cabinet (non rattaché) est ignorée, même plus récente.
    prismaMock.auditLogEntry.groupBy.mockResolvedValue([
      { establishmentId: "e1", actorUserId: "cabinet-1", _max: { occurredAt: new Date("2026-10-09") } },
      { establishmentId: "e1", actorUserId: "client-1", _max: { occurredAt: new Date("2026-09-01") } },
    ]);
    const { rows } = await getStructuresOverview();
    expect(rows[0]?.lastActivityAt).toEqual(new Date("2026-09-01"));
  });

  it("aucun compte client rattaché : pas de lecture du journal, aucune activité", async () => {
    prismaMock.establishmentUser.findMany.mockResolvedValue([]);
    const { rows } = await getStructuresOverview();
    expect(prismaMock.auditLogEntry.groupBy).not.toHaveBeenCalled();
    expect(rows.every((r) => r.lastActivityAt === null)).toBe(true);
  });

  it("aucune fiche : pas de lecture du journal", async () => {
    listEstablishments.mockResolvedValue([]);
    await expect(getStructuresOverview()).resolves.toEqual({ rows: [], portfolio: [] });
    expect(prismaMock.establishmentUser.findMany).not.toHaveBeenCalled();
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
