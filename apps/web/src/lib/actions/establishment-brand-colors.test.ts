import { beforeEach, describe, expect, it, vi } from "vitest";

// Charte couleur de la structure (E1, call du 09/11/2026). Ce qui est protégé : la
// garde AVANT toute lecture du formulaire et toute écriture (une structure d'un autre
// tenant, ou un rôle sans écriture, est refusé par requireEstablishmentInTenant) ; la
// validation serveur (jamais une valeur non vérifiée en base) ; l'effacement.

const prismaMock = { establishment: { update: vi.fn() } };
const requireEstablishmentInTenant = vi.fn();
class NotFound extends Error {}

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: vi.fn(),
  requireAdminEstablishmentInTenant: vi.fn(),
  structureScopeWhere: vi.fn(),
  requireEstablishmentAccess: vi.fn(),
  requireEstablishmentInTenant: (...args: unknown[]) => requireEstablishmentInTenant(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: vi.fn() }));

const { setEstablishmentBrandColors } = await import("./establishment");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({ establishmentId: "etab-1" });
  prismaMock.establishment.update.mockResolvedValue({});
});

describe("setEstablishmentBrandColors", () => {
  it("cas nominal : couleurs normalisées, écrites sur la structure vérifiée par la garde", async () => {
    const result = await setEstablishmentBrandColors(null, form({ establishmentId: "etab-1", primary: "#1a4d8f", secondary: "e3a41c" }));
    expect(result).toEqual({ ok: true });
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith("etab-1", "WRITE");
    expect(prismaMock.establishment.update).toHaveBeenCalledWith({
      where: { id: "etab-1" },
      data: { brandPrimaryColor: "#1A4D8F", brandSecondaryColor: "#E3A41C" },
    });
  });

  it("deux champs vides effacent la charte", async () => {
    await setEstablishmentBrandColors(null, form({ establishmentId: "etab-1", primary: "", secondary: "" }));
    expect(prismaMock.establishment.update).toHaveBeenCalledWith({
      where: { id: "etab-1" },
      data: { brandPrimaryColor: null, brandSecondaryColor: null },
    });
  });

  it("hors périmètre (autre tenant, rôle sans écriture) : la garde refuse, rien n'est écrit", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new NotFound("NEXT_NOT_FOUND"));
    await expect(setEstablishmentBrandColors(null, form({ establishmentId: "etab-x", primary: "#1A4D8F" }))).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
  });

  it("valeur invalide : refusée avec un message, rien n'est écrit", async () => {
    const result = await setEstablishmentBrandColors(null, form({ establishmentId: "etab-1", primary: "bleu" }));
    expect(result).toEqual({ error: expect.stringMatching(/hexadécimal/) });
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
  });

  it("sans identifiant de structure : refusée avant la garde", async () => {
    expect(await setEstablishmentBrandColors(null, form({ primary: "#1A4D8F" }))).toEqual({ error: "Établissement manquant." });
    expect(requireEstablishmentInTenant).not.toHaveBeenCalled();
  });
});
