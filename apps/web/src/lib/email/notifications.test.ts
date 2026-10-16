import { beforeEach, describe, expect, it, vi } from "vitest";

// Le câblage de `notifyStructureActivity` (16/10/2026) : ce que les tests d'action ne
// peuvent pas voir, puisqu'ils simulent le module. Ici le module tourne POUR DE VRAI,
// avec le sélecteur de destinataires réel — seule la frontière (base, port e-mail) est
// doublée.
//
// Trois choses sont protégées, et aucune n'est visible depuis l'extérieur :
//   - le tenant est lu depuis l'ÉTABLISSEMENT, jamais reçu d'un appelant ;
//   - l'envoi ne fait jamais remonter d'erreur — le geste de la structure est déjà
//     enregistré quand l'e-mail part (règle en tête de notifications.ts) ;
//   - ni adresse ni nom dans le journal technique.

const prismaMock = {
  establishment: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
};
const getEmailPort = vi.fn();
const send = vi.fn();
const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("./index", () => ({ getEmailPort: () => getEmailPort() }));
// `appUrl` lit la configuration de l'application (lib/config/env.ts), qui REFUSE de
// démarrer sans variables d'environnement : c'est une frontière, on la double — le
// reste du module (sélecteur de destinataires, envois, comptage) tourne pour de vrai.
vi.mock("@/lib/config/app-url", () => ({ appUrl: (path: string) => `https://portail.test${path}` }));

const { notifyStructureActivity } = await import("./notifications");

const ETAB = "etab-1";

function givenCabinetUser(overrides: { email?: string; role?: string; isActive?: boolean; assigned?: string[] } = {}) {
  return {
    name: "Sandrine",
    email: overrides.email ?? "sandrine@eoda.test",
    role: overrides.role ?? "CABINET_ADMIN",
    isActive: overrides.isActive ?? true,
    establishmentAssignments: (overrides.assigned ?? []).map((establishmentId) => ({ establishmentId })),
  };
}

function called(input: { kind: "DEPOSIT" | "ACCEPTED" | "DECLARED_MISSING" } = { kind: "DEPOSIT" }) {
  return notifyStructureActivity({ establishmentId: ETAB, documentLabel: "Livret d'accueil", ...input });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.establishment.findUnique.mockResolvedValue({ name: "Structure test", tenantId: "tenant-1" });
  prismaMock.user.findMany.mockResolvedValue([givenCabinetUser()]);
  getEmailPort.mockReturnValue({ send });
  send.mockResolvedValue("SENT");
});

describe("notifyStructureActivity — destinataires", () => {
  it("cherche les comptes du tenant de l'ÉTABLISSEMENT, jamais d'un tenant reçu", async () => {
    await called();

    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: "tenant-1", isActive: true }),
      })
    );
  });

  it("prévient un compte du cabinet, avec l'intitulé du document et la fiche de la structure", async () => {
    await called({ kind: "ACCEPTED" });

    expect(send).toHaveBeenCalledTimes(1);
    const message = send.mock.calls[0]?.[0] as { to: string; subject: string; html: string };
    expect(message.to).toBe("sandrine@eoda.test");
    expect(message.subject).toBe("Document accepté par la structure — Livret d'accueil");
    expect(message.html).toContain("Structure test");
    expect(message.html).toContain(`/dashboard/cabinet/etablissements/${ETAB}`);
  });

  it("ne prévient pas une commerciale — le sélecteur réel est appliqué, pas une liste locale", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      givenCabinetUser({ email: "commercial@eoda.test", role: "CABINET_COMMERCIAL" }),
      givenCabinetUser(),
    ]);

    expect(await called()).toEqual({ sent: 1, total: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ to: "sandrine@eoda.test" });
  });

  it("ne prévient pas la consultante affectée à une AUTRE structure", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      givenCabinetUser({ role: "CABINET_EVALUATOR", assigned: ["etab-2"] }),
    ]);

    expect(await called()).toEqual({ sent: 0, total: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("ne prévient pas un compte désactivé", async () => {
    prismaMock.user.findMany.mockResolvedValue([givenCabinetUser({ isActive: false })]);

    expect(await called()).toEqual({ sent: 0, total: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("n'envoie qu'une fois quand deux comptes portent la même adresse", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      givenCabinetUser(),
      givenCabinetUser({ role: "CABINET_READONLY" }),
    ]);

    expect(await called()).toEqual({ sent: 1, total: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("ne fait rien quand l'établissement n'existe pas", async () => {
    prismaMock.establishment.findUnique.mockResolvedValue(null);

    expect(await called()).toEqual({ sent: 0, total: 0 });
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("notifyStructureActivity — un e-mail ne fait jamais échouer le geste", () => {
  it("un envoi refusé est compté, pas propagé", async () => {
    send.mockRejectedValue(new Error("SMTP indisponible"));

    expect(await called()).toEqual({ sent: 0, total: 1 });
    // Le journal technique porte le NOMBRE d'échecs, jamais l'adresse.
    const logged = consoleError.mock.calls.flat().join(" ");
    expect(logged).toContain("1/1");
    expect(logged).not.toContain("sandrine@eoda.test");
  });

  it("un port indisponible (production sans messagerie) ne remonte pas non plus", async () => {
    // getEmailPort LÈVE quand la production n'a pas de fournisseur : le geste de la
    // structure doit rester acquis, et l'appelant recevoir un état d'envoi.
    getEmailPort.mockImplementation(() => {
      throw new Error("Aucun fournisseur d'e-mail configuré");
    });

    await expect(called()).resolves.toEqual({ sent: 0, total: 0 });
    expect(consoleError).toHaveBeenCalled();
  });

  it("compte les envois réussis un par un", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      givenCabinetUser({ email: "a@eoda.test" }),
      givenCabinetUser({ email: "b@eoda.test", role: "CABINET_READONLY" }),
      givenCabinetUser({ email: "c@eoda.test", role: "CABINET_EVALUATOR", assigned: [ETAB] }),
    ]);
    send.mockResolvedValueOnce("SENT").mockResolvedValueOnce("NOT_CONFIGURED").mockResolvedValueOnce("SENT");

    // « Non configuré » n'est pas un succès : l'écran ne doit pas annoncer 3 envois.
    expect(await called()).toEqual({ sent: 2, total: 3 });
  });
});
