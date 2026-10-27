import { beforeEach, describe, expect, it, vi } from "vitest";

// La route du Word d'origine : la garde de l'APPAREIL, la version annoncée seule, la
// signature binaire, et la trace — sans personne.

const resolveTabletSession = vi.fn();
const readTabletDipc = vi.fn();
const download = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({ resolveTabletSession: () => resolveTabletSession() }));
vi.mock("@/lib/db/read-tablet-dipc", () => ({ readTabletDipc: (id: string) => readTabletDipc(id) }));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({ download: (key: string) => download(key) }) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));

const { GET } = await import("./route");

// Signature d'un .docx : archive ZIP qui contient word/document.xml.
const DOCX = Buffer.from("PK\u0003\u0004 [Content_Types].xml word/document.xml");
const call = (versionId: string) => GET(new Request("https://x/api/tablette/dipec/" + versionId), { params: Promise.resolve({ versionId }) });
const ready = { status: "READY", versionId: "v2", versionNumber: 2, validatedOn: "2026-10-07", text: "t", hasWord: true };

beforeEach(() => {
  vi.clearAllMocks();
  resolveTabletSession.mockResolvedValue({ establishmentId: "etab1" });
  readTabletDipc.mockResolvedValue({ source: ready, storage: new Map([["v2", { fileStorageKey: "k2", originalFilename: "DIPEC v2.docx" }], ["v1", { fileStorageKey: "k1", originalFilename: "v1.docx" }]]) });
  download.mockResolvedValue(DOCX);
});

describe("GET /api/tablette/dipec/[versionId]", () => {
  it("sans appareil enregistré ni salarié connecté : rien", async () => {
    resolveTabletSession.mockResolvedValue(null);
    await expect(call("v2")).rejects.toThrow("NOT_FOUND");
    expect(readTabletDipc).not.toHaveBeenCalled();
  });

  it("lit la structure de l'APPAREIL, et ne sert que la version annoncée", async () => {
    await expect(call("v1")).rejects.toThrow("NOT_FOUND");
    expect(readTabletDipc).toHaveBeenCalledWith("etab1");
    expect(download).not.toHaveBeenCalled();
    readTabletDipc.mockResolvedValue({ source: { status: "NOT_VALIDATED" }, storage: new Map() });
    await expect(call("v2")).rejects.toThrow("NOT_FOUND");
  });

  it("refuse un fichier qui n'est pas un Word par sa signature", async () => {
    download.mockResolvedValue(Buffer.from("%PDF-1.7"));
    await expect(call("v2")).rejects.toThrow("NOT_FOUND");
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("cas nominal : le Word en pièce jointe, jamais en cache, l'accès journalisé sans personne", async () => {
    const response = await call("v2");
    expect(download).toHaveBeenCalledWith("k2");
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment;/);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array(DOCX));
    expect(recordAuditEvent).toHaveBeenCalledWith({ action: "DOCUMENT_PREVIEWED", establishmentId: "etab1", targetId: "v2", detail: "tablette · DIPEC (Word) à remplir" });
  });
});
