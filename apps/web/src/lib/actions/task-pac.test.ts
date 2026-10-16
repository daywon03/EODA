import { beforeEach, describe, expect, it, vi } from "vitest";

// PAC (N5) : cabinet seul, proposition d'abord, création des seules propositions
// cochées et RECALCULÉES côté serveur.

const prismaMock = {
  actionItem: { findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
};
const requireEstablishmentInTenant = vi.fn();
const readPacInputs = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (id: string) => requireEstablishmentInTenant(id),
}));
vi.mock("@/lib/db/read-pac-inputs", () => ({ readPacInputs: (...a: unknown[]) => readPacInputs(...a) }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { proposePacFromEvaluation, createPacActions } = await import("./task-pac");

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) data.append(k, x);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({
    establishmentId: "e1",
    establishmentType: "SAD_AIDE",
    tenantId: "t-1",
    userId: "eoda-1",
    session: { user: { role: "CABINET_ADMIN" } },
  });
  readPacInputs.mockResolvedValue([
    { criterionId: "c-low", code: "2.2.5", label: "x", score: 2, isImperative: true, documents: [] },
    { criterionId: "c-ok", code: "1.1.1", label: "y", score: 4, isImperative: false, documents: [] },
    { criterionId: "c-open", code: "3.1.1", label: "z", score: 1, isImperative: false, documents: [] },
  ]);
  prismaMock.actionItem.findMany.mockResolvedValue([{ linkedCriterionId: "c-open" }]);
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops.map((_, i) => ({ id: `a${i}` })));
});

describe("proposePacFromEvaluation", () => {
  it("propose sans rien écrire : sous 4, sans action ouverte", async () => {
    const proposals = await proposePacFromEvaluation("e1");
    expect(proposals.map((p) => p.criterionId)).toEqual(["c-low"]);
    expect(prismaMock.actionItem.create).not.toHaveBeenCalled();
    expect(readPacInputs).toHaveBeenCalledWith("e1", "SAD_AIDE");
  });

  it("autre cabinet / client / non authentifié : la garde refuse", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(proposePacFromEvaluation("autre")).rejects.toThrow("NOT_FOUND");
    await expect(createPacActions(form({ establishmentId: "autre", criterionId: "c-low" }))).rejects.toThrow("NOT_FOUND");
    expect(readPacInputs).not.toHaveBeenCalled();
  });
});

describe("createPacActions", () => {
  it("crée seulement les propositions cochées encore valables", async () => {
    const result = await createPacActions(form({ establishmentId: "e1", criterionId: ["c-low", "c-ok", "c-open", "inventé"] }));
    expect(result).toEqual({ created: 1 });
    expect(prismaMock.actionItem.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.actionItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "PAC", linkedCriterionId: "c-low", ownerKind: "STRUCTURE", ownerFunction: null, tenantId: "t-1" }),
      })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ACTION_ITEM_CREATED", detail: "PAC · STRUCTURE" }));
  });

  it("rien de coché, ou plus rien à proposer : refus", async () => {
    expect(await createPacActions(form({ establishmentId: "e1" }))).toHaveProperty("error");
    expect(await createPacActions(form({ establishmentId: "e1", criterionId: "c-ok" }))).toHaveProperty("error");
    expect(await createPacActions(form({}))).toEqual({ error: "Structure manquante." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
