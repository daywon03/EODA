import { beforeEach, describe, expect, it, vi } from "vitest";

// « Bonjour {prénom}. » de l'accueil réduit (intervenant) : prénom de la fiche salarié
// liée au compte DANS sa structure, sinon du compte ; jamais l'e-mail.

const prismaMock = { staffMember: { findFirst: vi.fn() }, user: { findUnique: vi.fn() } };
const requireClientEstablishment = vi.fn();
vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/guards", () => ({ requireClientEstablishment: (...a: unknown[]) => requireClientEstablishment(...a) }));

const { getClientGreetingName } = await import("./client-greeting");

beforeEach(() => {
  vi.clearAllMocks();
  requireClientEstablishment.mockResolvedValue({ userId: "user-1", establishment: { id: "etab-1" } });
  prismaMock.staffMember.findFirst.mockResolvedValue(null);
  prismaMock.user.findUnique.mockResolvedValue(null);
});

describe("getClientGreetingName", () => {
  it("prend le prénom de la fiche salarié liée, dans SA structure", async () => {
    prismaMock.staffMember.findFirst.mockResolvedValue({ displayName: "Julien Martin (fictif)" });
    expect(await getClientGreetingName()).toBe("Julien");
    expect(requireClientEstablishment).toHaveBeenCalledWith("HOME");
    expect(prismaMock.staffMember.findFirst.mock.calls[0]![0].where).toEqual({ userId: "user-1", establishmentId: "etab-1", active: true });
  });

  it("sinon le nom du compte, et rien plutôt qu'un e-mail", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ name: "Awa (fictif)" });
    expect(await getClientGreetingName()).toBe("Awa");
    prismaMock.user.findUnique.mockResolvedValue({ name: null });
    expect(await getClientGreetingName()).toBeNull();
  });

  it("sans structure rattachée : pas de fiche salarié lue", async () => {
    requireClientEstablishment.mockResolvedValue({ userId: "user-1", establishment: null });
    expect(await getClientGreetingName()).toBeNull();
    expect(prismaMock.staffMember.findFirst).not.toHaveBeenCalled();
  });
});
