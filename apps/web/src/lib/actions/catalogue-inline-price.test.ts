import { beforeEach, describe, expect, it, vi } from "vitest";

// Recette du 13/10/2026 : « Enregistrer » un prix sur place dans le Catalogue ne
// disait rien — le prix était bien écrit, mais l'écran restait identique. L'action
// rend désormais un état « enregistré » distinct de l'état initial, que le
// formulaire affiche ; un refus reste un refus, sans écriture.

const prismaMock = {
  catalogueFormule: { findFirst: vi.fn(), update: vi.fn() },
  catalogueOption: { findFirst: vi.fn(), update: vi.fn() },
};
const requireCommercialSession = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  CommercialTier: { ESSENTIEL: "ESSENTIEL", PERFORMANCE: "PERFORMANCE", EXCELLENCE: "EXCELLENCE" },
  PricingUnit: { FORFAIT: "FORFAIT" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({ requireCommercialSession: () => requireCommercialSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: vi.fn() }));

const { updateFormuleMonthlyPrice, updateOptionPrice } = await import("./catalogue");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCommercialSession.mockResolvedValue({ userId: "u-1", tenantId: "t-1" });
});

describe("updateFormuleMonthlyPrice", () => {
  it("prix enregistré : le dit", async () => {
    prismaMock.catalogueFormule.findFirst.mockResolvedValue({ id: "f-1" });
    const result = await updateFormuleMonthlyPrice(null, form({ id: "f-1", monthlyPriceEuros: "99" }));
    expect(result).toEqual({ saved: true });
    expect(prismaMock.catalogueFormule.update).toHaveBeenCalledWith({ where: { id: "f-1" }, data: { monthlyPriceEuros: 99 } });
  });

  it("offre hors du tenant : notFound, aucune écriture", async () => {
    prismaMock.catalogueFormule.findFirst.mockResolvedValue(null);
    await expect(updateFormuleMonthlyPrice(null, form({ id: "autre", monthlyPriceEuros: "99" }))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.catalogueFormule.update).not.toHaveBeenCalled();
  });
});

describe("updateOptionPrice", () => {
  it("prix enregistré : le dit", async () => {
    prismaMock.catalogueOption.findFirst.mockResolvedValue({ id: "o-1", priceMaxEuros: null });
    expect(await updateOptionPrice(null, form({ id: "o-1", priceEuros: "500" }))).toEqual({ saved: true });
  });

  it("prix de départ au-dessus de la fourchette : refus, aucune écriture", async () => {
    prismaMock.catalogueOption.findFirst.mockResolvedValue({ id: "o-1", priceMaxEuros: 120 });
    const result = await updateOptionPrice(null, form({ id: "o-1", priceEuros: "130" }));
    expect(result).toEqual({ error: expect.stringMatching(/inférieur au prix maximum/) });
    expect(prismaMock.catalogueOption.update).not.toHaveBeenCalled();
  });
});
