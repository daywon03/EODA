import { beforeEach, describe, expect, it, vi } from "vitest";

// Revue des suggestions de critères (cabinet seul). Relecture de sécurité du 10/11/2026 :
// une suggestion tirée d'un document à accès restreint (le tampon, analysé avant la
// restriction) est une donnée lue dans son contenu — le cabinet ne la tranche pas.

const prismaMock = {
  documentCriterionSuggestion: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
};
const requireEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (id: string, need: unknown) => requireEstablishmentAccess(id, need),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));

const { confirmCriterionSuggestion, rejectCriterionSuggestion, confirmAllCriterionSuggestions } = await import("./criterion-suggestion");

const ordinary = (id: string, establishmentId = "etab-1") => ({
  id,
  status: "PENDING",
  document: { establishmentId, documentType: { code: "L2002_LIVRET_ACCUEIL" } },
});
const tampon = (id: string) => ({
  id,
  status: "PENDING",
  document: { establishmentId: "etab-1", documentType: { code: "DEPARTEMENT_TAMPON" } },
});

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue({ isClient: false, userId: "u-1", session: { user: { role: "CABINET_ADMIN" } } });
});

describe("confirmer / rejeter une suggestion", () => {
  it("tranche une suggestion d'un document ordinaire de CET établissement", async () => {
    prismaMock.documentCriterionSuggestion.findUnique.mockResolvedValue(ordinary("s-1"));
    expect(await confirmCriterionSuggestion("etab-1", "s-1")).toBeNull();
    expect(prismaMock.documentCriterionSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s-1" }, data: expect.objectContaining({ status: "CONFIRMED" }) })
    );
  });

  it("un compte client : notFound", async () => {
    requireEstablishmentAccess.mockResolvedValue({ isClient: true, userId: "c-1", session: { user: { role: "CLIENT_USER" } } });
    await expect(rejectCriterionSuggestion("etab-1", "s-1")).rejects.toThrow("NOT_FOUND");
  });

  it("une suggestion d'un autre établissement : notFound", async () => {
    prismaMock.documentCriterionSuggestion.findUnique.mockResolvedValue(ordinary("s-1", "etab-2"));
    await expect(confirmCriterionSuggestion("etab-1", "s-1")).rejects.toThrow("NOT_FOUND");
  });

  it("une suggestion d'un document à accès restreint : notFound, rien n'est écrit", async () => {
    prismaMock.documentCriterionSuggestion.findUnique.mockResolvedValue(tampon("s-t"));
    await expect(confirmCriterionSuggestion("etab-1", "s-t")).rejects.toThrow("NOT_FOUND");
    await expect(rejectCriterionSuggestion("etab-1", "s-t")).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.documentCriterionSuggestion.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("tout accepter", () => {
  it("écarte les suggestions d'un document à accès restreint, comme celles d'un autre établissement", async () => {
    prismaMock.documentCriterionSuggestion.findMany.mockResolvedValue([ordinary("s-1"), tampon("s-t"), ordinary("s-2", "etab-2")]);
    expect(await confirmAllCriterionSuggestions("etab-1", ["s-1", "s-t", "s-2"])).toBeNull();
    expect(prismaMock.documentCriterionSuggestion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["s-1"] } } })
    );
  });

  it("rien à trancher hors des documents restreints : aucune écriture", async () => {
    prismaMock.documentCriterionSuggestion.findMany.mockResolvedValue([tampon("s-t")]);
    expect(await confirmAllCriterionSuggestions("etab-1", ["s-t"])).toBeNull();
    expect(prismaMock.documentCriterionSuggestion.updateMany).not.toHaveBeenCalled();
  });
});
