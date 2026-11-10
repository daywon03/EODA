import { beforeEach, describe, expect, it, vi } from "vitest";

// L'adresse de DÉVELOPPEMENT du stockage local applique la même règle d'ouverture que
// les autres portes (`canOpenDocumentFile`) : elle n'ouvre pas ce que la production
// refuse — le tampon de la structure au cabinet, un brouillon d'EODA à la structure.

const findFirst = vi.fn();
const tryEstablishmentAccess = vi.fn();
const readFile = vi.fn();

vi.mock("@/lib/config/env", () => ({ isProductionRuntime: () => false }));
vi.mock("@eoda/database", () => ({ prisma: { documentVersion: { findFirst: (a: unknown) => findFirst(a) } } }));
vi.mock("@/lib/auth/guards", () => ({ tryEstablishmentAccess: (...a: unknown[]) => tryEstablishmentAccess(...a) }));
vi.mock("@/lib/storage/local-fs-storage-adapter", () => ({ STORAGE_ROOT: "/tmp/eoda-local-storage-test" }));
vi.mock("node:fs/promises", () => ({ readFile: (p: string) => readFile(p) }));

const { GET } = await import("./route");

const call = () =>
  GET(new Request("https://x/api/local-storage/etab-1/tampon.pdf"), { params: Promise.resolve({ key: ["etab-1", "tampon.pdf"] }) });

const row = (code: string, role = "CLIENT_USER") => ({
  originalFilename: "tampon.pdf",
  uploadedBy: { role },
  document: { establishmentId: "etab-1", validatedAt: null, documentType: { code } },
});

beforeEach(() => {
  vi.clearAllMocks();
  readFile.mockResolvedValue(Buffer.from("%PDF-1.4"));
});

describe("GET /api/local-storage/[...key] — règle d'ouverture", () => {
  it("refuse le tampon au cabinet, sans lire le fichier", async () => {
    findFirst.mockResolvedValue(row("DEPARTEMENT_TAMPON"));
    tryEstablishmentAccess.mockResolvedValue({ isClient: false, clientAccessRole: null });
    const response = await call();
    expect(response.status).toBe(404);
    expect(readFile).not.toHaveBeenCalled();
  });

  it("refuse un brouillon d'EODA non validé à la structure", async () => {
    findFirst.mockResolvedValue(row("L2002_LIVRET_ACCUEIL", "CABINET_ADMIN"));
    tryEstablishmentAccess.mockResolvedValue({ isClient: true, clientAccessRole: "DIRECTION" });
    expect((await call()).status).toBe(404);
  });

  it("sert le tampon à la direction de la structure", async () => {
    findFirst.mockResolvedValue(row("DEPARTEMENT_TAMPON"));
    tryEstablishmentAccess.mockResolvedValue({ isClient: true, clientAccessRole: "DIRECTION" });
    expect((await call()).status).toBe(200);
  });
});
