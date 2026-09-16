import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS de l'upload de logo côté CLIENT (D7) : c'est la garde
// d'autorisation la plus critique de cette fonctionnalité, ajoutée le 16/09/2026
// (Sandrine, call du 15/09 — jusqu'ici le logo n'était déposable que par le
// cabinet). `requireEstablishmentAccess` distingue déjà cabinet/client et
// périmètre (S2) ; ce test couvre la couche ajoutée par-dessus : refuser un
// compte CABINET sur la route client, et refuser l'écriture quand le dépôt est
// fermé (bibliothèque / accès révoqué), même pour le bon établissement.

const prismaMock = {
  establishment: { update: vi.fn() },
};

const requireEstablishmentAccess = vi.fn();
const validateLogoUpload = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: vi.fn(),
  requireEstablishmentInTenant: vi.fn(),
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
}));
vi.mock("@/lib/security/upload-validation-service", () => ({
  validateLogoUpload: (...args: unknown[]) => validateLogoUpload(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: vi.fn() }));

const { uploadEstablishmentLogoAsClient, removeEstablishmentLogoAsClient } = await import(
  "./establishment"
);

const ESTABLISHMENT_ID = "etab-1";

function uploadForm(): FormData {
  const formData = new FormData();
  formData.set("establishmentId", ESTABLISHMENT_ID);
  formData.set("logo", new File([Buffer.from("fake-png-bytes")], "logo.png"));
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  validateLogoUpload.mockReturnValue({ ok: true, dataUri: "data:image/png;base64,xyz" });
});

describe("uploadEstablishmentLogoAsClient", () => {
  it("refuse un compte CABINET (cette action est réservée à l'espace client)", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      isClient: false,
      establishmentId: ESTABLISHMENT_ID,
      missionAccess: "ACTIVE",
    });

    const result = await uploadEstablishmentLogoAsClient(null, uploadForm());

    expect(result).toEqual({ error: "Réservé à l'espace client." });
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
  });

  it("refuse le dépôt quand l'accompagnement n'accepte plus d'écriture (bibliothèque)", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      isClient: true,
      establishmentId: ESTABLISHMENT_ID,
      missionAccess: "LIBRARY",
    });

    const result = await uploadEstablishmentLogoAsClient(null, uploadForm());

    expect(result).toEqual({
      error: "Votre accompagnement est clos : le logo ne peut plus être modifié.",
    });
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
  });

  it("refuse le dépôt quand l'accès a été révoqué", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      isClient: true,
      establishmentId: ESTABLISHMENT_ID,
      missionAccess: "REVOKED",
    });

    const result = await uploadEstablishmentLogoAsClient(null, uploadForm());

    expect(result).toEqual({
      error: "Votre accompagnement est clos : le logo ne peut plus être modifié.",
    });
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
  });

  it("accepte le dépôt pour le bon client, accompagnement actif", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      isClient: true,
      establishmentId: ESTABLISHMENT_ID,
      missionAccess: "ACTIVE",
    });

    const result = await uploadEstablishmentLogoAsClient(null, uploadForm());

    expect(result).toBeNull();
    expect(prismaMock.establishment.update).toHaveBeenCalledWith({
      where: { id: ESTABLISHMENT_ID },
      data: { logoDataUri: "data:image/png;base64,xyz" },
    });
  });

  it("établissement manquant dans le formulaire : refus avant tout appel à la garde", async () => {
    const result = await uploadEstablishmentLogoAsClient(null, new FormData());

    expect(result).toEqual({ error: "Établissement manquant." });
    expect(requireEstablishmentAccess).not.toHaveBeenCalled();
  });
});

describe("removeEstablishmentLogoAsClient", () => {
  it("refuse un compte CABINET", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      isClient: false,
      establishmentId: ESTABLISHMENT_ID,
      missionAccess: "ACTIVE",
    });

    const result = await removeEstablishmentLogoAsClient(ESTABLISHMENT_ID);

    expect(result).toEqual({ error: "Réservé à l'espace client." });
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
  });

  it("refuse en bibliothèque (lecture seule)", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      isClient: true,
      establishmentId: ESTABLISHMENT_ID,
      missionAccess: "LIBRARY",
    });

    const result = await removeEstablishmentLogoAsClient(ESTABLISHMENT_ID);

    expect(result).toEqual({
      error: "Votre accompagnement est clos : le logo ne peut plus être modifié.",
    });
    expect(prismaMock.establishment.update).not.toHaveBeenCalled();
  });

  it("accepte le retrait pour le bon client, accompagnement actif", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      isClient: true,
      establishmentId: ESTABLISHMENT_ID,
      missionAccess: "ACTIVE",
    });

    const result = await removeEstablishmentLogoAsClient(ESTABLISHMENT_ID);

    expect(result).toBeNull();
    expect(prismaMock.establishment.update).toHaveBeenCalledWith({
      where: { id: ESTABLISHMENT_ID },
      data: { logoDataUri: null },
    });
  });
});
