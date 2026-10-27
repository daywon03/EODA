import { beforeEach, describe, expect, it, vi } from "vitest";

// DIPC à signer sur la tablette : la seule lecture serveur du parcours. Ce qu'elle lit,
// pour qui, et ce qu'elle journalise.

const prismaMock = { document: { findFirst: vi.fn() }, establishment: { findUnique: vi.fn() } };
const resolveTabletSession = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/guards", () => ({ resolveTabletSession: () => resolveTabletSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args) }));

const { getTabletDipcSource, getTabletStructureAddress } = await import("./tablet-admission");

const session = { deviceEnrollmentId: "dev1", tenantId: "t1", establishmentId: "etab1", establishmentName: "SAD Fictif", staffMemberId: "s1", staffDisplayName: "Camille" };
const day = (d: string) => new Date(`${d}T10:00:00Z`);

beforeEach(() => {
  vi.clearAllMocks();
  resolveTabletSession.mockResolvedValue(session);
});

describe("getTabletDipcSource", () => {
  it("sans session de tablette : rien n'est lu", async () => {
    resolveTabletSession.mockResolvedValue(null);
    expect(await getTabletDipcSource()).toBeNull();
    expect(prismaMock.document.findFirst).not.toHaveBeenCalled();
  });

  it("lit le DIPC de la structure de l'APPAREIL, jamais d'une autre", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    await getTabletDipcSource();
    expect(prismaMock.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { establishmentId: "etab1", documentType: { code: "L2002_DIPC" } } })
    );
  });

  it("cas nominal : la version d'EODA validée, et l'accès journalisé sans personne", async () => {
    prismaMock.document.findFirst.mockResolvedValue({
      validatedAt: day("2026-10-05"),
      versions: [
        { id: "v1", versionNumber: 1, uploadedAt: day("2026-09-01"), extractedText: "texte client", uploadedBy: { role: "CLIENT_USER" } },
        { id: "v2", versionNumber: 2, uploadedAt: day("2026-10-01"), extractedText: "DIPC d'EODA", uploadedBy: { role: "CABINET_EVALUATOR" } },
      ],
    });
    expect(await getTabletDipcSource()).toEqual({ status: "READY", versionId: "v2", versionNumber: 2, validatedOn: "2026-10-05", text: "DIPC d'EODA" });
    expect(recordAuditEvent).toHaveBeenCalledWith({ action: "DOCUMENT_PREVIEWED", establishmentId: "etab1", targetId: "v2", detail: "tablette · DIPC à signer" });
  });

  it("DIPC absent ou non validé : on le dit, rien n'est journalisé", async () => {
    prismaMock.document.findFirst.mockResolvedValue(null);
    expect(await getTabletDipcSource()).toEqual({ status: "ABSENT" });
    prismaMock.document.findFirst.mockResolvedValue({
      validatedAt: null,
      versions: [{ id: "v2", versionNumber: 2, uploadedAt: day("2026-10-01"), extractedText: "x", uploadedBy: { role: "CABINET_ADMIN" } }],
    });
    expect(await getTabletDipcSource()).toEqual({ status: "NOT_VALIDATED" });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });
});

describe("getTabletStructureAddress", () => {
  it("sans session de tablette : rien n'est lu", async () => {
    resolveTabletSession.mockResolvedValue(null);
    expect(await getTabletStructureAddress()).toBeNull();
    expect(prismaMock.establishment.findUnique).not.toHaveBeenCalled();
  });

  it("l'adresse de la structure de l'APPAREIL ; vide si elle n'est pas saisie", async () => {
    prismaMock.establishment.findUnique.mockResolvedValue({ address: "1 avenue Fictive" });
    expect(await getTabletStructureAddress()).toBe("1 avenue Fictive");
    expect(prismaMock.establishment.findUnique).toHaveBeenCalledWith({ where: { id: "etab1" }, select: { address: true } });
    prismaMock.establishment.findUnique.mockResolvedValue({ address: null });
    expect(await getTabletStructureAddress()).toBe("");
  });
});
