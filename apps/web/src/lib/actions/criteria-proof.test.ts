import { beforeEach, describe, expect, it, vi } from "vitest";

// Onglet « Critères » (N4) : la garde de fiche passe d'abord ; la lecture est bornée
// à la structure et à son profil ; le mode de la mission décide de « prouvé ».

const prismaMock = {
  criterion: { findMany: vi.fn() },
  document: { findMany: vi.fn() },
};
const requireEstablishmentInTenant = vi.fn();
const getEstablishmentSupportMode = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (id: string) => requireEstablishmentInTenant(id),
}));
vi.mock("@/lib/services/establishment-offer-service", () => ({
  getEstablishmentSupportMode: (id: string) => getEstablishmentSupportMode(id),
}));

const { getStructureCriteriaProof } = await import("./criteria-proof");

const criterion = (code: string, applicableTo: string, requirementLevel: string, typeIds: string[]) => ({
  id: `c-${code}`,
  code,
  label: `Critère ${code}`,
  requirementLevel,
  applicableTo,
  objective: { theme: { chapter: { number: Number(code[0]) } } },
  documentTypes: typeIds.map((documentTypeId) => ({ documentTypeId })),
});

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({ establishmentId: "e1", establishmentType: "SAD_AIDE" });
  getEstablishmentSupportMode.mockResolvedValue("ACCOMPAGNE");
  prismaMock.criterion.findMany.mockResolvedValue([
    criterion("2.2.2", "BOTH", "IMPERATIF", ["t-dipc"]),
    criterion("3.6.2", "SAD_MIXTE", "IMPERATIF", ["t-dipc"]),
    criterion("1.1.1", "BOTH", "STANDARD", []),
  ]);
  prismaMock.document.findMany.mockResolvedValue([
    {
      establishmentId: "e1",
      documentTypeId: "t-dipc",
      validatedAt: new Date(2026, 9, 5),
      clientAcceptedAt: null,
      currentVersion: { uploadedAt: new Date(2026, 9, 1) },
    },
  ]);
});

describe("getStructureCriteriaProof", () => {
  it("SAD aide : critères du profil seulement, impératifs prouvés comptés", async () => {
    const proof = await getStructureCriteriaProof("e1");
    expect(proof.rows.map((r) => [r.code, r.status])).toEqual([
      ["1.1.1", "NON_RATTACHE"],
      ["2.2.2", "PROUVE"],
    ]);
    expect(proof.imperatives).toEqual({ proven: 1, total: 1 });
    expect(proof.expectedImperatives).toBe(16);
    expect(prismaMock.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { establishmentId: { in: ["e1"] }, documentTypeId: { not: null } } })
    );
  });

  it("SAD mixte : voit 3.6.2, impératif ; autonomie : la relecture EODA ne suffit pas", async () => {
    requireEstablishmentInTenant.mockResolvedValue({ establishmentId: "e1", establishmentType: "SAD_MIXTE" });
    getEstablishmentSupportMode.mockResolvedValue("AUTONOMIE");
    const proof = await getStructureCriteriaProof("e1");
    expect(proof.rows.map((r) => r.code)).toContain("3.6.2");
    expect(proof.imperatives).toEqual({ proven: 0, total: 2 });
    expect(proof.expectedImperatives).toBe(17);
  });

  it("fiche d'un autre cabinet / non authentifié : la garde refuse, rien n'est lu", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(getStructureCriteriaProof("autre")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.criterion.findMany).not.toHaveBeenCalled();
  });
});
