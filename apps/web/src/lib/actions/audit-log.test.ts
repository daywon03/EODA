import { beforeEach, describe, expect, it, vi } from "vitest";

// Journal d'audit (audit du 28/10/2026) : les entrées sans structure — connexions,
// devis, rôles — ne se lisent qu'avec l'administration du cabinet.

const prismaMock = {
  establishment: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  auditLogEntry: { findMany: vi.fn(), count: vi.fn() },
};
const requireCabinetSession = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock, AuditAction: { DOCUMENT_UPLOADED: "DOCUMENT_UPLOADED" } }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: (c: unknown) => requireCabinetSession(c),
  requireEstablishmentInTenant: vi.fn(),
  structureScopeWhere: (context: { tenantId: string }) => ({ tenantId: context.tenantId }),
}));

const { listAuditLog } = await import("./audit-log");

function scopeOf(): unknown {
  const call = prismaMock.auditLogEntry.findMany.mock.calls[0]?.[0] as { where: { AND: unknown[] } };
  return call.where.AND[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.establishment.findMany.mockResolvedValue([{ id: "e1", name: "Structure" }]);
  prismaMock.user.findMany.mockResolvedValue([{ id: "u1", name: "S", role: "CABINET_ADMIN" }]);
  prismaMock.auditLogEntry.findMany.mockResolvedValue([]);
  prismaMock.auditLogEntry.count.mockResolvedValue(0);
});

describe("listAuditLog — portée", () => {
  it("administration : les structures ET les entrées du cabinet", async () => {
    requireCabinetSession.mockResolvedValue({ tenantId: "t1", role: "CABINET_ADMIN", structureScope: { kind: "ALL" } });
    await listAuditLog({});
    expect(scopeOf()).toEqual({
      OR: [
        { establishmentId: { in: ["e1"] } },
        { establishmentId: null, actorUserId: { in: ["u1"] } },
        { establishmentId: null, actorUserId: null },
      ],
    });
  });

  it("consultante ou lecture seule : le journal de SES structures, rien d'autre", async () => {
    for (const role of ["CABINET_EVALUATOR", "CABINET_READONLY"]) {
      vi.clearAllMocks();
      prismaMock.establishment.findMany.mockResolvedValue([{ id: "e1", name: "Structure" }]);
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.auditLogEntry.findMany.mockResolvedValue([]);
      prismaMock.auditLogEntry.count.mockResolvedValue(0);
      requireCabinetSession.mockResolvedValue({ tenantId: "t1", role, structureScope: { kind: "ALL" } });
      await listAuditLog({});
      expect(scopeOf()).toEqual({ OR: [{ establishmentId: { in: ["e1"] } }] });
    }
  });
});
