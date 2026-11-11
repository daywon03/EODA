import { beforeEach, describe, expect, it, vi } from "vitest";

// Le logo de la coquille du portail client : la structure vient du LIEN du compte
// (garde), jamais d'un paramètre ; sans structure (accès révoqué) ou sans logo, 404 ;
// seul un PNG / JPEG reconnu par signature est servi.

class NotFoundError extends Error {}

const findUnique = vi.fn();
const requireClientEstablishment = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError("NEXT_NOT_FOUND");
  },
}));
vi.mock("@eoda/database", () => ({ prisma: { establishment: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock("@/lib/auth/guards", () => ({
  requireClientEstablishment: (...a: unknown[]) => requireClientEstablishment(...a),
}));

const { GET } = await import("./route");

// PNG minimal : la signature suffit à `decodeLogoDataUri`.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const PNG_DATA_URI = `data:image/png;base64,${PNG.toString("base64")}`;

beforeEach(() => {
  vi.clearAllMocks();
  requireClientEstablishment.mockResolvedValue({ establishment: { id: "etab-1", name: "SAD fictif", type: "SAD_AIDE" } });
  findUnique.mockResolvedValue({ logoDataUri: PNG_DATA_URI });
});

describe("GET /api/client/logo", () => {
  it("sert le logo de la structure du compte, lu par son lien, avec un cache navigateur seulement", async () => {
    const response = await GET();

    expect(requireClientEstablishment).toHaveBeenCalledWith("HOME");
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "etab-1" }, select: { logoDataUri: true } });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG);
  });

  it("accès révoqué (aucune structure rendue par la garde) : 404, sans lire la base", async () => {
    requireClientEstablishment.mockResolvedValue({ establishment: null });
    await expect(GET()).rejects.toBeInstanceOf(NotFoundError);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("garde qui refuse (pas un compte client) : l'erreur de la garde remonte, rien n'est lu", async () => {
    requireClientEstablishment.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("aucun logo déposé : 404", async () => {
    findUnique.mockResolvedValue({ logoDataUri: null });
    await expect(GET()).rejects.toBeInstanceOf(NotFoundError);
  });

  it("un data URI dont les octets ne sont pas une image reconnue n'est pas servi", async () => {
    findUnique.mockResolvedValue({ logoDataUri: `data:image/png;base64,${Buffer.from("<svg/>").toString("base64")}` });
    await expect(GET()).rejects.toBeInstanceOf(NotFoundError);
  });
});
