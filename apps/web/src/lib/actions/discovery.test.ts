import { beforeEach, describe, expect, it, vi } from "vitest";

// Ce qui est vérifié ici : remplir la grille de découverte fait passer le
// prospect de NOUVEAU à RDV — automatiquement, en une transaction avec sa trace
// dans l'historique — mais UNIQUEMENT quand la grille contient réellement une
// réponse, et jamais si le prospect a déjà avancé au-delà de NOUVEAU (une
// négociation en cours ne doit pas reculer parce qu'on relit la grille).

const prismaMock = {
  prospect: { findFirst: vi.fn(), update: vi.fn() },
  prospectTimelineEntry: { create: vi.fn() },
  $transaction: vi.fn((ops: unknown[]) => Promise.resolve(ops)),
};

const requireCabinetAdminSession = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: () => requireCabinetAdminSession(),
}));

const { saveDiscoveryAnswers } = await import("./discovery");

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("saveDiscoveryAnswers — avancement automatique du statut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCabinetAdminSession.mockResolvedValue({ tenantId: "tenant-1", userId: "user-1" });
    prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops));
  });

  it("fait passer NOUVEAU -> RDV quand la grille contient une vraie réponse", async () => {
    prismaMock.prospect.findFirst.mockResolvedValue({ id: "p1", status: "NOUVEAU" });

    const result = await saveDiscoveryAnswers(
      "p1",
      null,
      formData({ taille: "Association de 40 salariés, deux antennes." })
    );

    expect(result).toEqual({ ok: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const ops = prismaMock.$transaction.mock.calls[0]?.[0] as unknown[];
    expect(ops).toHaveLength(2);
    expect(prismaMock.prospect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1" },
        data: expect.objectContaining({ status: "RDV" }),
      })
    );
    expect(prismaMock.prospectTimelineEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prospectId: "p1",
          kind: "CHANGEMENT_STATUT",
          statusFrom: "NOUVEAU",
          statusTo: "RDV",
        }),
      })
    );
  });

  it("ne change pas le statut si la grille est enregistrée vide", async () => {
    prismaMock.prospect.findFirst.mockResolvedValue({ id: "p1", status: "NOUVEAU" });

    await saveDiscoveryAnswers("p1", null, formData({}));

    expect(prismaMock.prospect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: expect.anything() }),
      })
    );
    expect(prismaMock.prospectTimelineEntry.create).not.toHaveBeenCalled();
  });

  it("ne fait jamais reculer un prospect déjà avancé au-delà de NOUVEAU", async () => {
    prismaMock.prospect.findFirst.mockResolvedValue({ id: "p1", status: "NEGOCIATION" });

    await saveDiscoveryAnswers("p1", null, formData({ taille: "Relecture en cours." }));

    expect(prismaMock.prospect.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: expect.anything() }),
      })
    );
    expect(prismaMock.prospectTimelineEntry.create).not.toHaveBeenCalled();
  });
});
