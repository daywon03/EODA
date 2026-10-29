import { beforeEach, describe, expect, it, vi } from "vitest";

// La direction d'une structure ouvre ou ferme SA structure à une consultante d'EODA
// (29/10/2026) : jamais une autre structure, jamais un compte qui n'est pas une
// consultante active du même cabinet, rien une fois l'accompagnement clos.

const prismaMock = {
  establishment: { findUnique: vi.fn() },
  user: { findMany: vi.fn(), findFirst: vi.fn() },
  establishmentAssignment: { upsert: vi.fn(), deleteMany: vi.fn() },
};
const requireClientEstablishment = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireClientEstablishment: (need: unknown) => requireClientEstablishment(need) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));

const { getStructureConsultants, setStructureConsultant } = await import("./structure-consultants");

beforeEach(() => {
  vi.clearAllMocks();
  requireClientEstablishment.mockResolvedValue({ userId: "u-dir", establishment: { id: "etab-1" }, missionAccess: "ACTIVE" });
  prismaMock.establishment.findUnique.mockResolvedValue({ tenantId: "t-1" });
  prismaMock.user.findFirst.mockResolvedValue({ id: "c-1" });
});

describe("getStructureConsultants", () => {
  it("lit en ACCESS_READ les consultantes ACTIVES du cabinet de la structure, et dit lesquelles la suivent", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "c-1", name: "Consultante A", email: "a@eoda.test", establishmentAssignments: [{ establishmentId: "etab-1" }] },
      { id: "c-2", name: "Consultante B", email: "b@eoda.test", establishmentAssignments: [] },
    ]);
    const result = await getStructureConsultants();
    expect(requireClientEstablishment).toHaveBeenCalledWith({ module: "ACCESS", mode: "READ" });
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "t-1", role: "CABINET_EVALUATOR", isActive: true } })
    );
    expect(result?.rows.map((r) => [r.userId, r.assigned])).toEqual([
      ["c-1", true],
      ["c-2", false],
    ]);
  });
});

describe("setStructureConsultant", () => {
  it("un rôle sans ACCESS_WRITE est refusé par la garde, avant toute lecture", async () => {
    requireClientEstablishment.mockRejectedValue(new Error("REDIRECT"));
    await expect(setStructureConsultant("c-1", true)).rejects.toThrow("REDIRECT");
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("affecte la consultante à CETTE structure seulement, et journalise", async () => {
    expect(await setStructureConsultant("c-1", true)).toBeNull();
    expect(requireClientEstablishment).toHaveBeenCalledWith({ module: "ACCESS", mode: "WRITE" });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c-1", tenantId: "t-1", role: "CABINET_EVALUATOR", isActive: true } })
    );
    expect(prismaMock.establishmentAssignment.upsert).toHaveBeenCalledWith({
      where: { userId_establishmentId: { userId: "c-1", establishmentId: "etab-1" } },
      create: { tenantId: "t-1", establishmentId: "etab-1", userId: "c-1" },
      update: {},
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CABINET_USER_ASSIGNMENTS_UPDATED", establishmentId: "etab-1", targetId: "c-1" })
    );
  });

  it("retire l'affectation de CETTE structure seulement", async () => {
    await setStructureConsultant("c-1", false);
    expect(prismaMock.establishmentAssignment.deleteMany).toHaveBeenCalledWith({ where: { userId: "c-1", establishmentId: "etab-1" } });
  });

  it("un compte qui n'est pas une consultante active du cabinet : notFound, rien n'est écrit", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(setStructureConsultant("admin-ou-autre-cabinet", true)).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.establishmentAssignment.upsert).not.toHaveBeenCalled();
  });

  it("accompagnement clos : refusé, rien n'est écrit", async () => {
    requireClientEstablishment.mockResolvedValue({ userId: "u-dir", establishment: { id: "etab-1" }, missionAccess: "LIBRARY" });
    expect(await setStructureConsultant("c-1", true)).toEqual({ error: expect.stringMatching(/clos/) });
    expect(prismaMock.establishmentAssignment.upsert).not.toHaveBeenCalled();
  });
});
