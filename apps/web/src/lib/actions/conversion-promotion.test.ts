import { beforeEach, describe, expect, it, vi } from "vitest";

// BASCULE À LA SIGNATURE (tranche 11, décision de Damon). Quand le devis d'une
// structure inscrite seule est signé, son compte PROSPECT_USER devient un accès
// CLIENT_USER à la fiche créée, rôle DIRECTION, DANS la transaction de signature,
// et c'est journalisé. Un prospect démarché, sans compte, reste inchangé.

const tx = {
  devis: { findFirst: vi.fn(), update: vi.fn() },
  establishment: { create: vi.fn(), findFirstOrThrow: vi.fn() },
  prospect: { update: vi.fn() },
  mission: { create: vi.fn() },
  missionOption: { createMany: vi.fn() },
  prospectAccount: { findMany: vi.fn() },
  user: { updateMany: vi.fn() },
  establishmentUser: { createMany: vi.fn() },
};
const prismaMock = {
  devis: { findFirst: vi.fn() },
  mission: { findUnique: vi.fn() },
  establishment: { findFirst: vi.fn() },
  $transaction: vi.fn((run: (t: typeof tx) => unknown) => run(tx)),
};
const requireCommercialSession = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  EstablishmentType: { SAD_AIDE: "SAD_AIDE", SAD_MIXTE: "SAD_MIXTE" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({ requireCommercialSession: () => requireCommercialSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));

const { convertDevisToClient } = await import("./conversion");

function form(): FormData {
  const data = new FormData();
  data.set("type", "SAD_AIDE");
  data.set("finessNumber", "990000017");
  data.set("address", "12 rue des Lilas, 99000 Ville-Fictive");
  data.set("hasEvaluationTargetDate", "2027-01-15");
  return data;
}

const DEVIS = {
  id: "devis-1",
  number: "DEV-2026-001",
  status: "ENVOYE",
  tenantId: "t-1",
  catalogueFormule: { formule: "ESSENTIEL" },
  options: [],
  prospect: {
    id: "p-1",
    tenantId: "t-1",
    structureName: "SAD Les Glycines (fictif)",
    structureType: "ASSOCIATION",
    contactEmail: null,
    contactName: null,
    establishmentId: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireCommercialSession.mockResolvedValue({ userId: "u-admin", tenantId: "t-1", role: "CABINET_ADMIN" });
  prismaMock.devis.findFirst.mockResolvedValue(DEVIS);
  prismaMock.establishment.findFirst.mockResolvedValue(null);
  tx.devis.findFirst.mockResolvedValue({ status: "ENVOYE" });
  tx.establishment.create.mockResolvedValue({ id: "etab-1", name: "SAD Les Glycines (fictif)" });
  tx.mission.create.mockResolvedValue({ id: "mission-1" });
  tx.prospectAccount.findMany.mockResolvedValue([]);
});

describe("signature du devis d'une structure inscrite seule", () => {
  it("le compte PROSPECT_USER devient CLIENT_USER, rattaché à la fiche en DIRECTION, dans la transaction", async () => {
    tx.prospectAccount.findMany.mockResolvedValue([{ userId: "user-online", user: { role: "PROSPECT_USER" } }]);

    const result = await convertDevisToClient("devis-1", null, form());

    expect(result).toMatchObject({ ok: true, establishmentId: "etab-1", promotedAccountCount: 1 });
    expect(tx.prospectAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { prospectId: "p-1" } }));
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["user-online"] }, role: "PROSPECT_USER" },
      data: { role: "CLIENT_USER" },
    });
    expect(tx.establishmentUser.createMany).toHaveBeenCalledWith({
      data: [{ userId: "user-online", establishmentId: "etab-1", roleInEstablishment: "AUTRE", accessRole: "DIRECTION" }],
      skipDuplicates: true,
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PROSPECT_ACCOUNT_PROMOTED", targetId: "user-online", establishmentId: "etab-1" })
    );
  });

  it("un compte qui n'est plus PROSPECT_USER n'est pas touché", async () => {
    tx.prospectAccount.findMany.mockResolvedValue([{ userId: "user-x", user: { role: "CLIENT_USER" } }]);
    const result = await convertDevisToClient("devis-1", null, form());
    expect(result).toMatchObject({ ok: true, promotedAccountCount: 0 });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.establishmentUser.createMany).not.toHaveBeenCalled();
  });

  it("prospect démarché, sans compte : rien ne bascule, rien n'est journalisé à ce titre", async () => {
    const result = await convertDevisToClient("devis-1", null, form());
    expect(result).toMatchObject({ ok: true, promotedAccountCount: 0 });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.establishmentUser.createMany).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({ action: "PROSPECT_ACCOUNT_PROMOTED" }));
  });

  it("si la bascule échoue, toute la signature est annulée (même transaction)", async () => {
    tx.prospectAccount.findMany.mockResolvedValue([{ userId: "user-online", user: { role: "PROSPECT_USER" } }]);
    tx.user.updateMany.mockRejectedValueOnce(new Error("contrainte"));
    const result = await convertDevisToClient("devis-1", null, form());
    expect(result).toMatchObject({ ok: false });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("devis d'un autre cabinet : introuvable, rien ne bascule", async () => {
    prismaMock.devis.findFirst.mockResolvedValue(null);
    await expect(convertDevisToClient("devis-x", null, form())).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("non autorisé : la garde refuse avant toute lecture", async () => {
    requireCommercialSession.mockRejectedValue(new Error("REDIRECT"));
    await expect(convertDevisToClient("devis-1", null, form())).rejects.toThrow("REDIRECT");
    expect(prismaMock.devis.findFirst).not.toHaveBeenCalled();
  });
});
