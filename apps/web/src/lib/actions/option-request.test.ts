import { beforeEach, describe, expect, it, vi } from "vitest";

// Cas de REFUS de la file des demandes d'options, côté Cabinet (D7).
//   - la lecture est filtrée par le tenant de l'appelant, sans condition ;
//   - un identifiant de demande reçu par formulaire est une entrée non fiable :
//     hors tenant ⇒ notFound(), jamais un redirect qui révélerait son existence ;
//   - un statut arbitraire est rejeté par le parseur, pas par un cast ;
//   - une demande déjà traitée ne se retraite pas (pas de double avenant).

class NotFoundError extends Error {}

const prismaMock = {
  clientOptionRequest: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
};

const requireCabinetAdminSession = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  OptionRequestStatus: { DEMANDEE: "DEMANDEE", TRAITEE: "TRAITEE", REFUSEE: "REFUSEE" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: () => requireCabinetAdminSession(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { handleOptionRequest, listPendingOptionRequests } = await import("./option-request");

function form(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({
    session: { user: { id: "admin-1" } },
    userId: "admin-1",
    tenantId: "tenant-1",
  });
  prismaMock.clientOptionRequest.findMany.mockResolvedValue([]);
  prismaMock.clientOptionRequest.findFirst.mockResolvedValue(null);
  prismaMock.clientOptionRequest.update.mockResolvedValue({});
});

describe("listPendingOptionRequests", () => {
  it("filtre par le tenant de l'appelant, sans condition (fail-closed)", async () => {
    await listPendingOptionRequests();

    expect(prismaMock.clientOptionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1", status: "DEMANDEE" } })
    );
  });
});

describe("handleOptionRequest — refus", () => {
  it("refuse une demande d'un autre tenant par notFound(), sans rien écrire", async () => {
    prismaMock.clientOptionRequest.findFirst.mockResolvedValue(null);

    await expect(
      handleOptionRequest(form({ requestId: "req-autre-tenant", status: "TRAITEE" }))
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(prismaMock.clientOptionRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "req-autre-tenant", tenantId: "tenant-1" } })
    );
    expect(prismaMock.clientOptionRequest.update).not.toHaveBeenCalled();
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("rejette un statut qui n'appartient pas à l'énumération", async () => {
    const result = await handleOptionRequest(form({ requestId: "req-1", status: "GRATUIT" }));

    expect(result.ok).toBe(false);
    expect(prismaMock.clientOptionRequest.findFirst).not.toHaveBeenCalled();
  });

  it("refuse de remettre une demande en attente", async () => {
    const result = await handleOptionRequest(form({ requestId: "req-1", status: "DEMANDEE" }));

    expect(result).toEqual({
      ok: false,
      error: "Une demande ne peut pas être remise en attente.",
    });
    expect(prismaMock.clientOptionRequest.update).not.toHaveBeenCalled();
  });

  it("refuse de retraiter une demande déjà traitée", async () => {
    prismaMock.clientOptionRequest.findFirst.mockResolvedValue({
      id: "req-1",
      status: "TRAITEE",
      establishmentId: "etab-1",
      catalogueOptionId: "opt-1",
    });

    const result = await handleOptionRequest(form({ requestId: "req-1", status: "REFUSEE" }));

    expect(result).toEqual({ ok: false, error: "Cette demande a déjà été traitée." });
    expect(prismaMock.clientOptionRequest.update).not.toHaveBeenCalled();
  });

  it("marque la demande traitée et journalise une clé technique", async () => {
    prismaMock.clientOptionRequest.findFirst.mockResolvedValue({
      id: "req-1",
      status: "DEMANDEE",
      establishmentId: "etab-1",
      catalogueOptionId: "opt-1",
    });

    const result = await handleOptionRequest(form({ requestId: "req-1", status: "TRAITEE" }));

    expect(result).toEqual({ ok: true });
    expect(prismaMock.clientOptionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "req-1" } })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "OPTION_REQUEST_HANDLED",
        establishmentId: "etab-1",
        targetId: "opt-1",
        detail: "TRAITEE",
      })
    );
  });
});
