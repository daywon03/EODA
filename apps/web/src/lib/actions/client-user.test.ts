import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS et de RÉVOCATION du cycle de vie d'un accès client (D7).
// Ce qui est réellement vérifié ici, et nulle part ailleurs :
//   - un identifiant d'utilisateur reçu par l'action est une entrée non fiable : il
//     doit être rattaché à l'établissement du tenant de l'appelant, sinon refus ;
//   - un compte Cabinet n'est jamais manipulable par cette voie ;
//   - retirer le DERNIER rattachement désactive le compte — sans quoi il continuerait
//     de s'authentifier sans plus rien à voir (c'est le trou que la phase ferme) ;
//   - le mot de passe temporaire n'apparaît dans aucun événement d'audit.
// Seules les frontières (base, garde, journal, empreinte) sont doublées.

type TxCallback<T> = (tx: unknown) => Promise<T>;

const prismaMock = {
  establishmentUser: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  user: { update: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn(),
};

const requireEstablishmentInTenant = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  EstablishmentUserRole: {
    DIRECTEUR: "DIRECTEUR",
    COORDINATEUR: "COORDINATEUR",
    ASSISTANT_QUALITE: "ASSISTANT_QUALITE",
    AUTRE: "AUTRE",
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentInTenant: (...args: [string]) => requireEstablishmentInTenant(...args),
  structureScopeWhere: (context: { tenantId: string }) => ({ tenantId: context.tenantId, id: { in: ["scope"] } }),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
// Marqueur `not-a-real-secret` en anglais : voir password-policy.test.ts pour le
// pourquoi — les analyseurs de secrets reconnaissent les valeurs factices sur une
// liste de mots anglais, pas sur « mot-de-passe-jetable ».
vi.mock("@/lib/security/password-hashing", () => ({
  generateTemporaryPassword: () => "placeholder-jetable-not-a-real-secret",
  hashPassword: () => Promise.resolve("empreinte"),
}));

const {
  removeClientUserFromEstablishment,
  resetClientUserPassword,
  setClientUserActive,
  updateClientUser,
} = await import("./client-user");

const ESTABLISHMENT_ID = "etab-1";
const USER_ID = "user-client";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function targetForm(extra: Record<string, string> = {}): FormData {
  return form({ establishmentId: ESTABLISHMENT_ID, userId: USER_ID, ...extra });
}

function givenLink(user: Partial<{ role: string; isActive: boolean }> = {}): void {
  prismaMock.establishmentUser.findUnique.mockResolvedValue({
    userId: USER_ID,
    establishmentId: ESTABLISHMENT_ID,
    roleInEstablishment: "DIRECTEUR",
    user: {
      id: USER_ID,
      name: "Interlocuteur Test",
      email: "interlocuteur@example.org",
      role: "CLIENT_USER",
      isActive: true,
      ...user,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentInTenant.mockResolvedValue({
    establishmentId: ESTABLISHMENT_ID,
    tenantId: "tenant-1",
    userId: "user-cabinet",
    session: { user: { id: "user-cabinet", role: "CABINET_ADMIN" } },
  });
  prismaMock.$transaction.mockImplementation(async (arg: TxCallback<unknown> | unknown[]) =>
    typeof arg === "function" ? arg(prismaMock) : Promise.all(arg)
  );
  prismaMock.establishmentUser.count.mockResolvedValue(0);
});

describe("compte rattaché à une structure hors périmètre (audit du 28/10/2026)", () => {
  it("mot de passe, e-mail, activation : refusés — le compte vaut pour TOUTES ses structures", async () => {
    givenLink();
    prismaMock.establishmentUser.count.mockResolvedValue(1);
    for (const result of [
      await resetClientUserPassword(targetForm()),
      await setClientUserActive(form({ establishmentId: ESTABLISHMENT_ID, userId: USER_ID, isActive: "false" })),
    ]) {
      expect(result).toEqual({ error: expect.stringContaining("seul un administrateur du cabinet peut le modifier") });
    }
    expect(prismaMock.establishmentUser.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, revokedAt: null, NOT: { establishment: { tenantId: "tenant-1", id: { in: ["scope"] } } } },
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("refus", () => {
  it("refuse sans établissement, avant même d'appeler la garde", async () => {
    const result = await setClientUserActive(form({ userId: USER_ID, isActive: "false" }));

    expect(result).toEqual({ error: "Établissement manquant." });
    expect(requireEstablishmentInTenant).not.toHaveBeenCalled();
  });

  it("refuse sans identifiant d'interlocuteur", async () => {
    const result = await setClientUserActive(
      form({ establishmentId: ESTABLISHMENT_ID, isActive: "false" })
    );

    expect(result).toEqual({ error: "Interlocuteur manquant." });
  });

  it("propage le refus de la garde (établissement d'un autre tenant)", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));

    await expect(removeClientUserFromEstablishment(targetForm())).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.establishmentUser.delete).not.toHaveBeenCalled();
  });

  it("refuse un utilisateur non rattaché à cet établissement", async () => {
    prismaMock.establishmentUser.findUnique.mockResolvedValue(null);

    const result = await removeClientUserFromEstablishment(targetForm());

    expect(result).toEqual({ error: "Cet interlocuteur n'existe pas pour cet établissement." });
    expect(prismaMock.establishmentUser.delete).not.toHaveBeenCalled();
  });

  it("refuse de toucher à un compte Cabinet, avec le même message qu'un compte inexistant", async () => {
    givenLink({ role: "CABINET_EVALUATOR" });

    const result = await setClientUserActive(targetForm({ isActive: "false" }));

    expect(result).toEqual({ error: "Cet interlocuteur n'existe pas pour cet établissement." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse une valeur d'activation qui n'est ni true ni false", async () => {
    givenLink();

    const result = await setClientUserActive(targetForm({ isActive: "1" }));

    expect(result).toEqual({ error: "Valeur invalide." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse un rôle hors enum sur la correction de fiche", async () => {
    givenLink();

    const result = await updateClientUser(
      targetForm({ name: "Nouveau Nom", roleInEstablishment: "PRESIDENT" })
    );

    expect(result).toEqual({ error: "Le rôle dans l'établissement a une valeur invalide." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("refuse de réinitialiser le mot de passe d'un compte désactivé", async () => {
    givenLink({ isActive: false });

    const result = await resetClientUserPassword(targetForm());

    expect(result).toEqual({
      error: "Ce compte est désactivé : réactivez-le avant de réinitialiser son mot de passe.",
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("révocation", () => {
  it("désactive le compte quand le rattachement retiré était le dernier", async () => {
    givenLink();
    prismaMock.establishmentUser.count.mockResolvedValue(0);

    const result = await removeClientUserFromEstablishment(targetForm());

    expect(result).toEqual({ success: true });
    expect(prismaMock.establishmentUser.delete).toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({ isActive: false }),
      })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "USER_DEACTIVATED", targetId: USER_ID })
    );
  });

  it("conserve le compte actif s'il reste rattaché à un autre établissement", async () => {
    givenLink();
    prismaMock.establishmentUser.count.mockResolvedValue(1);

    await removeClientUserFromEstablishment(targetForm());

    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CLIENT_USER_UNLINKED" })
    );
    expect(recordAuditEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "USER_DEACTIVATED" })
    );
  });

  it("réarme la rotation et l'horodatage de révocation à la réinitialisation", async () => {
    givenLink();

    const result = await resetClientUserPassword(targetForm());

    expect(result).toMatchObject({ success: true, tempPassword: "placeholder-jetable-not-a-real-secret" });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mustChangePassword: true,
          passwordChangedAt: expect.any(Date),
        }),
      })
    );
    // Le mot de passe temporaire ne doit apparaître dans AUCUN événement d'audit.
    const auditPayloads = JSON.stringify(recordAuditEvent.mock.calls);
    expect(auditPayloads).not.toContain("placeholder-jetable-not-a-real-secret");
  });
});

describe("modification de l'adresse e-mail par le cabinet (bilan §3.2)", () => {
  const editForm = (email: string): FormData =>
    targetForm({ name: "Interlocuteur Test", roleInEstablishment: "DIRECTEUR", email });

  it("change l'adresse quand elle est libre, et ne l'écrit pas dans le journal", async () => {
    givenLink();
    prismaMock.user.findUnique.mockResolvedValue(null);

    const result = await updateClientUser(editForm("nouvelle@example.org"));

    expect(result).toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { name: "Interlocuteur Test", email: "nouvelle@example.org" },
    });
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("nouvelle@example.org");
  });

  it("refuse une adresse déjà utilisée par un autre compte, sans rien écrire", async () => {
    givenLink();
    prismaMock.user.findUnique.mockResolvedValue({ id: "autre-compte" });

    const result = await updateClientUser(editForm("prise@example.org"));

    expect(result).toEqual({ error: "Cette adresse e-mail est déjà utilisée par un autre compte." });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("refuse une adresse invalide", async () => {
    givenLink();
    const result = await updateClientUser(editForm("pas-une-adresse"));
    expect(result).toHaveProperty("error");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("adresse inchangée : aucune vérification d'unicité", async () => {
    givenLink();
    const result = await updateClientUser(editForm("interlocuteur@example.org"));
    expect(result).toEqual({ success: true });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuse l'interlocuteur d'une structure d'un autre cabinet (garde)", async () => {
    requireEstablishmentInTenant.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(updateClientUser(editForm("x@example.org"))).rejects.toThrow("NOT_FOUND");
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
