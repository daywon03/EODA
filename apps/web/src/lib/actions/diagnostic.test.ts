import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDiagnosticSnapshot, diagnosticFingerprint } from "@/lib/services/diagnostic-service";
import { describeDiagnosticValidation } from "@/lib/services/diagnostic-validation-service";
import type { CriterionProofRow } from "@/lib/services/criteria-proof-service";

// Les deux gestes du diagnostic (N6). Ce qui est protégé : le cabinet seul marque
// « relu », la structure seule « accepte » ; en autonomie pas de relecture EODA ;
// un identifiant hors périmètre répond comme introuvable ; l'accès au rapport est
// journalisé. Les règles (diagnostic-validation-service) tournent pour de vrai.

const prismaMock = { diagnosticValidation: { create: vi.fn(), update: vi.fn() } };
const requireClientEstablishment = vi.fn();
const requireEstablishmentInTenant = vi.fn();
const requireEstablishmentAccess = vi.fn();
const readDiagnostic = vi.fn();
const recordAuditEvent = vi.fn();
class NotFound extends Error {}

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFound("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireClientEstablishment: () => requireClientEstablishment(),
  requireEstablishmentInTenant: (id: string) => requireEstablishmentInTenant(id),
  requireEstablishmentAccess: (id: string) => requireEstablishmentAccess(id),
}));
vi.mock("@/lib/db/read-diagnostic", () => ({ readDiagnostic: (id: string) => readDiagnostic(id) }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { acceptDiagnostic, getClientDiagnostic, getDiagnosticForPrint, getStructureDiagnostic, markDiagnosticReviewed } =
  await import("./diagnostic");

const ETAB = "etab-fictif";
const ROW: CriterionProofRow = {
  id: "c1",
  code: "3.12.1",
  label: "Plaintes",
  chapterNumber: 3,
  isImperative: true,
  expectedDocumentTypeIds: [],
  status: "SANS_PREUVE",
  expected: 0,
  deposited: 0,
  proven: 0,
};

function givenDiagnostic(mode: "ACCOMPAGNE" | "AUTONOMIE", latest: { reviewed?: boolean; accepted?: boolean } | null = null) {
  const fingerprint = diagnosticFingerprint([ROW]);
  const latestValidation = latest
    ? {
        id: "v1",
        snapshotJson: buildDiagnosticSnapshot([ROW], new Date()),
        reviewedByEodaAt: latest.reviewed ? new Date() : null,
        acceptedByClientAt: latest.accepted ? new Date() : null,
      }
    : null;
  readDiagnostic.mockResolvedValue({
    establishmentId: ETAB,
    mode,
    rows: [ROW],
    fingerprint,
    latestValidation,
    summary: { imperatives: { proven: 0, total: 1 } },
    validation: describeDiagnosticValidation(mode, latestValidation, fingerprint),
  });
}

const CLIENT = {
  userId: "user-client",
  session: { user: { role: "CLIENT_USER" } },
  establishment: { id: ETAB },
  missionAccess: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireClientEstablishment.mockResolvedValue(CLIENT);
  requireEstablishmentInTenant.mockResolvedValue({ establishmentId: ETAB, userId: "user-cabinet", role: "CABINET_EVALUATOR" });
  prismaMock.diagnosticValidation.create.mockResolvedValue({ id: "v-new" });
  prismaMock.diagnosticValidation.update.mockResolvedValue({ id: "v1" });
});

describe("markDiagnosticReviewed — geste du cabinet", () => {
  it("accompagné : fige la photo, pose la relecture et la journalise", async () => {
    givenDiagnostic("ACCOMPAGNE");
    expect(await markDiagnosticReviewed(ETAB)).toBeNull();
    const data = prismaMock.diagnosticValidation.create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data).toMatchObject({ establishmentId: ETAB, reviewedByEodaById: "user-cabinet" });
    expect(data).not.toHaveProperty("acceptedByClientAt");
    expect(data.snapshotJson).toMatchObject({ version: 1, rows: [{ code: "3.12.1", status: "SANS_PREUVE" }] });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DIAGNOSTIC_REVIEWED_BY_EODA", targetId: "v-new" }));
  });

  it("autonomie : refusé, rien n'est écrit", async () => {
    givenDiagnostic("AUTONOMIE");
    expect(await markDiagnosticReviewed(ETAB)).toEqual({ error: expect.stringMatching(/autonomie/) });
    expect(prismaMock.diagnosticValidation.create).not.toHaveBeenCalled();
  });

  it("idempotent : une relecture à jour ne se redate pas", async () => {
    givenDiagnostic("ACCOMPAGNE", { reviewed: true });
    expect(await markDiagnosticReviewed(ETAB)).toBeNull();
    expect(prismaMock.diagnosticValidation.create).not.toHaveBeenCalled();
  });

  it("hors tenant ou client : la garde répond introuvable", async () => {
    requireEstablishmentInTenant.mockImplementation(() => {
      throw new NotFound("NEXT_NOT_FOUND");
    });
    await expect(markDiagnosticReviewed("autre-tenant")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(readDiagnostic).not.toHaveBeenCalled();
  });

  it("établissement disparu : introuvable", async () => {
    readDiagnostic.mockResolvedValue(null);
    await expect(markDiagnosticReviewed(ETAB)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("acceptDiagnostic — geste de la structure", () => {
  it("accompagné : accepte la relecture à jour, sans toucher la relecture", async () => {
    givenDiagnostic("ACCOMPAGNE", { reviewed: true });
    expect(await acceptDiagnostic()).toBeNull();
    const call = prismaMock.diagnosticValidation.update.mock.calls[0]?.[0] as { where: unknown; data: Record<string, unknown> };
    expect(call.where).toEqual({ id: "v1" });
    expect(call.data).toEqual({ acceptedByClientAt: expect.any(Date), acceptedByClientById: "user-client" });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "DIAGNOSTIC_ACCEPTED_BY_CLIENT" }));
  });

  it("accompagné : refusé avant la relecture d'EODA", async () => {
    givenDiagnostic("ACCOMPAGNE");
    expect(await acceptDiagnostic()).toEqual({ error: expect.stringMatching(/pas encore relu/) });
    expect(prismaMock.diagnosticValidation.update).not.toHaveBeenCalled();
    expect(prismaMock.diagnosticValidation.create).not.toHaveBeenCalled();
  });

  it("autonomie : accepte seule, sans relecture EODA, et le journal le dit", async () => {
    givenDiagnostic("AUTONOMIE");
    expect(await acceptDiagnostic()).toBeNull();
    const data = prismaMock.diagnosticValidation.create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data).toMatchObject({ establishmentId: ETAB, acceptedByClientById: "user-client" });
    expect(data).not.toHaveProperty("reviewedByEodaAt");
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ detail: "autonomie, non relu par EODA" }));
  });

  it("mission close : lecture seule", async () => {
    requireClientEstablishment.mockResolvedValue({ ...CLIENT, missionAccess: "LIBRARY" });
    givenDiagnostic("AUTONOMIE");
    expect(await acceptDiagnostic()).toEqual({ error: expect.stringMatching(/terminé/) });
    expect(prismaMock.diagnosticValidation.create).not.toHaveBeenCalled();
  });

  it("aucune structure rattachée (ou accès révoqué) : introuvable", async () => {
    requireClientEstablishment.mockResolvedValue({ ...CLIENT, establishment: null });
    await expect(acceptDiagnostic()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("lectures", () => {
  it("le client lit SA structure, jamais un identifiant reçu", async () => {
    givenDiagnostic("AUTONOMIE");
    await getClientDiagnostic();
    expect(readDiagnostic).toHaveBeenCalledWith(ETAB);
    requireClientEstablishment.mockResolvedValue({ ...CLIENT, establishment: null });
    expect(await getClientDiagnostic()).toBeNull();
  });

  it("le cabinet lit sous la garde du tenant", async () => {
    givenDiagnostic("ACCOMPAGNE");
    await getStructureDiagnostic(ETAB);
    expect(requireEstablishmentInTenant).toHaveBeenCalledWith(ETAB);
    readDiagnostic.mockResolvedValue(null);
    await expect(getStructureDiagnostic(ETAB)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("le rapport imprimable est journalisé, des deux côtés", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      establishmentId: ETAB,
      userId: "user-client",
      isClient: true,
      session: { user: { role: "CLIENT_USER" } },
    });
    givenDiagnostic("AUTONOMIE");
    await getDiagnosticForPrint(ETAB);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DIAGNOSTIC_REPORT_PRINTED", establishmentId: ETAB, detail: "structure" })
    );
    readDiagnostic.mockResolvedValue(null);
    await expect(getDiagnosticForPrint(ETAB)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
