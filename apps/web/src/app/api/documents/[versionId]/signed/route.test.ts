import { beforeEach, describe, expect, it, vi } from "vitest";

// La copie signée et tamponnée (12/11/2026) : mêmes portes que l'original, servie en
// pièce jointe, type décidé par signature. EODA y a droit (décision de Damon du 12/11).

const findUnique = vi.fn();
const tryEstablishmentAccess = vi.fn();
const download = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@eoda/database", () => ({ prisma: { documentVersion: { findUnique: (a: unknown) => findUnique(a) } } }));
vi.mock("@/lib/auth/guards", () => ({ tryEstablishmentAccess: (...a: unknown[]) => tryEstablishmentAccess(...a) }));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({ download: (key: string) => download(key) }) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));

const { GET } = await import("./route");

const PDF = Buffer.from("%PDF-1.4 signé");
const params = { params: Promise.resolve({ versionId: "v-3" }) };
const request = new Request("https://x/api/documents/v-3/signed");

function version(patch: Record<string, unknown> = {}) {
  return {
    id: "v-3",
    originalFilename: "Procédure plaintes.pdf",
    signedFileStorageKey: "etab-1/dt/v3-1-plaintes-signe.pdf",
    uploadedBy: { role: "CLIENT_USER" },
    document: { establishmentId: "etab-1", validatedAt: new Date("2026-11-02"), documentType: { code: "QUALITE_PROCEDURE_PLAINTES" } },
    ...patch,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue(version());
  download.mockResolvedValue(PDF);
  tryEstablishmentAccess.mockResolvedValue({ isClient: false, clientAccessRole: null, userId: "u-cab", session: { user: { role: "CABINET_ADMIN" } } });
});

describe("GET /api/documents/[versionId]/signed", () => {
  it("le cabinet télécharge la copie signée, en pièce jointe, et c'est journalisé", async () => {
    const response = await GET(request, params);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="Proce-dure-plaintes-signe.pdf"');
    expect(download).toHaveBeenCalledWith("etab-1/dt/v3-1-plaintes-signe.pdf");
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DOCUMENT_DOWNLOADED", targetId: "v-3" }));
  });

  it("une version sans copie signée : introuvable, rien n'est lu", async () => {
    findUnique.mockResolvedValue(version({ signedFileStorageKey: null }));
    await expect(GET(request, params)).rejects.toThrow("NOT_FOUND");
    expect(tryEstablishmentAccess).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it("hors périmètre : introuvable, rien n'est lu", async () => {
    tryEstablishmentAccess.mockResolvedValue(null);
    await expect(GET(request, params)).rejects.toThrow("NOT_FOUND");
    expect(download).not.toHaveBeenCalled();
  });

  it("un brouillon d'EODA non validé reste fermé à la structure", async () => {
    findUnique.mockResolvedValue(version({ uploadedBy: { role: "CABINET_ADMIN" }, document: { ...version().document, validatedAt: null } }));
    tryEstablishmentAccess.mockResolvedValue({ isClient: true, clientAccessRole: "DIRECTION", userId: "u-1", session: { user: { role: "CLIENT_USER" } } });
    await expect(GET(request, params)).rejects.toThrow("NOT_FOUND");
    expect(download).not.toHaveBeenCalled();
  });

  it("un contenu qui n'est ni Word ni PDF n'est jamais servi", async () => {
    download.mockResolvedValue(Buffer.from("<html><script>x</script></html>"));
    await expect(GET(request, params)).rejects.toThrow("NOT_FOUND");
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});
