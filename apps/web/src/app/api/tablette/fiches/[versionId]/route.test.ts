import { beforeEach, describe, expect, it, vi } from "vitest";

// La route d'une fiche de sensibilisation : la garde de l'APPAREIL, la fiche annoncée
// seule, la signature binaire, et la trace — sans personne.

const resolveTabletSession = vi.fn();
const readTabletAwarenessSheets = vi.fn();
const download = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({ resolveTabletSession: () => resolveTabletSession() }));
vi.mock("@/lib/db/read-tablet-awareness-sheets", () => ({
  readTabletAwarenessSheets: (id: string) => readTabletAwarenessSheets(id),
}));
vi.mock("@/lib/storage", () => ({ getFileStoragePort: () => ({ download: (key: string) => download(key) }) }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (e: unknown) => recordAuditEvent(e) }));

const { GET } = await import("./route");

const DOCX = Buffer.from("PK\u0003\u0004 [Content_Types].xml word/document.xml");
const call = (versionId: string) => GET(new Request("https://x/api/tablette/fiches/" + versionId), { params: Promise.resolve({ versionId }) });

beforeEach(() => {
  vi.clearAllMocks();
  resolveTabletSession.mockResolvedValue({ establishmentId: "etab1" });
  readTabletAwarenessSheets.mockResolvedValue({
    sheets: { PA_FICHE_P1_PLAINTES: { versionId: "f1", originalFilename: "P1.docx" } },
    storage: new Map([
      ["f1", { fileStorageKey: "k1", originalFilename: "P1.docx" }],
      ["f0", { fileStorageKey: "k0", originalFilename: "ancienne.docx" }],
    ]),
  });
  download.mockResolvedValue(DOCX);
});

describe("GET /api/tablette/fiches/[versionId]", () => {
  it("sans appareil enregistré ni salarié connecté : rien", async () => {
    resolveTabletSession.mockResolvedValue(null);
    await expect(call("f1")).rejects.toThrow("NOT_FOUND");
    expect(readTabletAwarenessSheets).not.toHaveBeenCalled();
  });

  it("lit la structure de l'APPAREIL et ne sert qu'une fiche annoncée (validée)", async () => {
    await expect(call("f0")).rejects.toThrow("NOT_FOUND");
    expect(readTabletAwarenessSheets).toHaveBeenCalledWith("etab1");
    expect(download).not.toHaveBeenCalled();
  });

  it("refuse un fichier au type inconnu par sa signature", async () => {
    download.mockResolvedValue(Buffer.from("du texte"));
    await expect(call("f1")).rejects.toThrow("NOT_FOUND");
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("cas nominal : la fiche, jamais en cache, l'accès journalisé sans personne", async () => {
    const response = await call("f1");
    expect(download).toHaveBeenCalledWith("k1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(recordAuditEvent).toHaveBeenCalledWith({
      action: "DOCUMENT_PREVIEWED",
      establishmentId: "etab1",
      targetId: "f1",
      detail: "tablette · document de la structure",
    });
  });
});
