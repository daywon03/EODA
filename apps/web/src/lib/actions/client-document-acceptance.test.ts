import { beforeEach, describe, expect, it, vi } from "vitest";

// « Je l'accepte » (D6, N2). Ce qui est protégé ici : la structure n'accepte que ce
// qu'on lui a MONTRÉ, sur SA structure ; le geste ne touche jamais `validatedAt` ;
// le cabinet n'a pas ce geste. Les règles de visibilité ne sont pas simulées
// (analysis-view-service et client-documents-view-service tournent pour de vrai).

const prismaMock = {
  document: { findUnique: vi.fn(), update: vi.fn() },
};
const requireEstablishmentAccess = vi.fn();
const recordAuditEvent = vi.fn();
const getEstablishmentSupportMode = vi.fn();
const notifyStructureActivity = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireEstablishmentAccess: (...args: [string]) => requireEstablishmentAccess(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));
vi.mock("@/lib/services/establishment-offer-service", () => ({
  getEstablishmentSupportMode: (...args: [string]) => getEstablishmentSupportMode(...args),
}));
vi.mock("@/lib/email/notifications", () => ({
  notifyStructureActivity: (...args: unknown[]) => notifyStructureActivity(...args),
}));

const { acceptDocument } = await import("./client-document-acceptance");

const ETAB = "etab-fictif";
const TYPE = "dt-livret";
const UPLOADED = new Date("2026-10-01T10:00:00Z");
const ANALYSIS = { elementsPresents: [], elementsManquants: ["Horaires de la permanence"], suggestionsCorrection: [], sembleConforme: false };

const CLIENT_ACCESS = {
  userId: "user-client",
  isClient: true,
  session: { user: { role: "CLIENT_USER" } },
  missionAccess: "ACTIVE",
};

function givenDocument(overrides: { analysisReviewedAt?: Date | null; validatedAt?: Date | null; clientAcceptedAt?: Date | null; hasVersion?: boolean } = {}) {
  prismaMock.document.findUnique.mockResolvedValue({
    id: "doc-1",
    validatedAt: overrides.validatedAt ?? null,
    clientAcceptedAt: overrides.clientAcceptedAt ?? null,
    documentType: { code: "L2002_LIVRET_ACCUEIL", label: "Livret d'accueil" },
    currentVersion:
      overrides.hasVersion === false
        ? null
        : { uploadedAt: UPLOADED, analysisResultJson: ANALYSIS, analysisReviewedAt: overrides.analysisReviewedAt ?? null },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireEstablishmentAccess.mockResolvedValue(CLIENT_ACCESS);
  getEstablishmentSupportMode.mockResolvedValue("ACCOMPAGNE");
  prismaMock.document.update.mockResolvedValue({});
  notifyStructureActivity.mockResolvedValue({ sent: 1, total: 1 });
});

describe("acceptDocument — cas nominal", () => {
  it("accompagné : accepte un document relu par EODA, sans toucher validatedAt, et le journalise", async () => {
    givenDocument({ analysisReviewedAt: new Date("2026-10-02") });

    expect(await acceptDocument(ETAB, TYPE)).toBeNull();

    const data = prismaMock.document.update.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(data).toEqual({ clientAcceptedAt: expect.any(Date), clientAcceptedByUserId: "user-client" });
    expect(data).not.toHaveProperty("validatedAt");
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DOCUMENT_ACCEPTED_BY_CLIENT", targetId: "doc-1", detail: "L2002_LIVRET_ACCUEIL" })
    );
  });

  it("autonomie : accepte l'analyse affichée sous la réserve, même non relue", async () => {
    getEstablishmentSupportMode.mockResolvedValue("AUTONOMIE");
    givenDocument();

    expect(await acceptDocument(ETAB, TYPE)).toBeNull();
    expect(prismaMock.document.update).toHaveBeenCalledTimes(1);
  });

  it("est idempotent : une acceptation déjà valable n'est pas redatée", async () => {
    givenDocument({ analysisReviewedAt: new Date("2026-10-02"), clientAcceptedAt: new Date("2026-10-03") });

    expect(await acceptDocument(ETAB, TYPE)).toBeNull();
    expect(prismaMock.document.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("acceptDocument — refus", () => {
  it("refuse un document NON visible : accompagné et pas encore relu", async () => {
    givenDocument();

    expect(await acceptDocument(ETAB, TYPE)).toMatchObject({ error: expect.stringContaining("relu") });
    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });

  it("refuse un document sans version", async () => {
    givenDocument({ hasVersion: false });
    expect(await acceptDocument(ETAB, TYPE)).toMatchObject({ error: expect.any(String) });
    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });

  it("refuse un autre établissement : la garde lève notFound, rien n'est lu", async () => {
    requireEstablishmentAccess.mockRejectedValue(new Error("NEXT_NOT_FOUND"));
    await expect(acceptDocument("etab-autre", TYPE)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prismaMock.document.findUnique).not.toHaveBeenCalled();
  });

  it("refuse le cabinet (notFound) : accepter est la parole de la structure", async () => {
    requireEstablishmentAccess.mockResolvedValue({ ...CLIENT_ACCESS, isClient: false });
    await expect(acceptDocument(ETAB, TYPE)).rejects.toThrow();
    expect(prismaMock.document.update).not.toHaveBeenCalled();
  });

  it("refuse en bibliothèque (mission close)", async () => {
    requireEstablishmentAccess.mockResolvedValue({ ...CLIENT_ACCESS, missionAccess: "LIBRARY" });
    expect(await acceptDocument(ETAB, TYPE)).toMatchObject({ error: expect.stringContaining("terminé") });
    expect(prismaMock.document.findUnique).not.toHaveBeenCalled();
  });

  it("refuse des identifiants qui ne sont pas des chaînes", async () => {
    await expect(acceptDocument(42 as unknown as string, TYPE)).rejects.toThrow();
    expect(requireEstablishmentAccess).not.toHaveBeenCalled();
  });
});

// Le cabinet est prévenu de l'acceptation (16/10/2026). C'est une fin de cycle — le
// geste par lequel la structure engage sa parole — et le cabinet ne l'apprenait qu'en
// rouvrant la fiche. Ce qui est protégé ici : l'événement part APRÈS l'écriture (une
// acceptation qui n'a pas été enregistrée ne s'annonce pas) et ne part pas quand il n'y
// a rien à annoncer.
describe("acceptDocument — le cabinet est prévenu", () => {
  it("annonce l'ACCEPTATION, avec le libellé du type de document", async () => {
    givenDocument({ analysisReviewedAt: new Date("2026-10-02") });

    expect(await acceptDocument(ETAB, TYPE)).toBeNull();

    expect(notifyStructureActivity).toHaveBeenCalledWith({
      establishmentId: ETAB,
      documentLabel: "Livret d'accueil",
      kind: "ACCEPTED",
    });
    // Le code technique du type ne voyage pas : ce sont des mots pour une personne.
    const call = notifyStructureActivity.mock.calls[0]?.[0] as { documentLabel: string };
    expect(call.documentLabel).not.toContain("L2002_LIVRET_ACCUEIL");
  });

  it("un second clic (acceptation déjà valable) ne renvoie pas d'e-mail", async () => {
    givenDocument({ analysisReviewedAt: new Date("2026-10-02"), clientAcceptedAt: new Date("2026-10-03") });

    expect(await acceptDocument(ETAB, TYPE)).toBeNull();

    expect(notifyStructureActivity).not.toHaveBeenCalled();
  });

  it("un refus (document non relu) ne prévient personne", async () => {
    givenDocument();

    expect(await acceptDocument(ETAB, TYPE)).toMatchObject({ error: expect.any(String) });

    expect(notifyStructureActivity).not.toHaveBeenCalled();
  });
});
