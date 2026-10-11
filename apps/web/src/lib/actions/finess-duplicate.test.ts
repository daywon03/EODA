import { beforeEach, describe, expect, it, vi } from "vitest";

// FINESS EN DOUBLE (bilan du 08/10/2026, retour de démo du 15/09 : « ça laisse
// continuer »). Le refus doit être EXPLICITE aux deux endroits où une fiche reçoit un
// FINESS : sa création (signature d'un devis) et sa modification. Ce qui est prouvé
// ici : le message de `finessConflictError`, et AUCUNE écriture tentée — sans ce
// contrôle, la contrainte unique levait une erreur brute (modification) ou tombait
// dans le `catch` général de la conversion (« conversion déjà enregistrée »).

const prismaMock = {
  devis: { findFirst: vi.fn() },
  mission: { findUnique: vi.fn() },
  establishment: { findFirst: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
};
const requireCabinetAdminSession = vi.fn();
const requireEstablishmentInTenant = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  EstablishmentType: { SAD_AIDE: "SAD_AIDE", SAD_MIXTE: "SAD_MIXTE" },
  StructureType: { ASSOCIATION: "ASSOCIATION", CCAS_CIAS: "CCAS_CIAS", PRIVE: "PRIVE" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: () => requireCabinetAdminSession(),
  requireCabinetSession: vi.fn(),
  requireAdminEstablishmentInTenant: vi.fn(),
  requireEstablishmentAccess: vi.fn(),
  requireEstablishmentInTenant: (id: string) => requireEstablishmentInTenant(id),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: vi.fn() }));

const { updateEstablishment } = await import("./establishment");
const { convertDevisToClient } = await import("./conversion");
const { finessConflictError } = await import("@/lib/services/structure-identity-service");

const CONFLICT = finessConflictError(true);

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({ userId: "u-admin", tenantId: "t-1" });
  requireEstablishmentInTenant.mockResolvedValue({ establishmentId: "etab-1" });
});

describe("modification d'une fiche — FINESS déjà porté par une autre fiche", () => {
  const validForm = form({
    name: "SAD Les Glycines (fictif)",
    type: "SAD_AIDE",
    structureType: "ASSOCIATION",
    finessNumber: "99 00 00 017",
    address: "12 rue des Lilas, 99000 Ville-Fictive",
    hasEvaluationTargetDate: "2027-01-15",
  });

  it("refuse explicitement et n'écrit rien", async () => {
    prismaMock.establishment.findFirst.mockResolvedValue({ id: "etab-autre" });

    const result = await updateEstablishment("etab-1", null, validForm);

    expect(result).toEqual({ error: CONFLICT });
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
    // Le FINESS comparé est la forme NORMALISÉE, et la fiche elle-même est exclue.
    expect(prismaMock.establishment.findFirst).toHaveBeenCalledWith({
      where: { finessNumber: "990000017", NOT: { id: "etab-1" } },
      select: { id: true },
    });
  });

  it("enregistre quand le FINESS n'est porté par aucune autre fiche", async () => {
    prismaMock.establishment.findFirst.mockResolvedValue(null);
    await expect(updateEstablishment("etab-1", null, validForm)).rejects.toThrow("REDIRECT");
    expect(prismaMock.establishment.update).toHaveBeenCalledTimes(1);
  });

  it("refuse une fiche d'un autre cabinet avant toute lecture (garde)", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(updateEstablishment("etab-x", null, validForm)).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.establishment.findFirst).not.toHaveBeenCalled();
  });
});

describe("création d'une fiche à la signature — FINESS déjà rattaché", () => {
  it("refuse explicitement, avant la transaction", async () => {
    prismaMock.devis.findFirst.mockResolvedValue({
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
    });
    prismaMock.establishment.findFirst.mockResolvedValue({ id: "etab-existant" });

    const result = await convertDevisToClient(
      "devis-1",
      null,
      form({
        type: "SAD_AIDE",
        finessNumber: "990000017",
        address: "12 rue des Lilas, 99000 Ville-Fictive",
        hasEvaluationTargetDate: "2027-01-15",
      })
    );

    expect(result).toEqual({ ok: false, error: CONFLICT });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
