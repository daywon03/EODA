import { beforeEach, describe, expect, it, vi } from "vitest";

// Relance d'une structure inscrite seule : garde commerciale, prospect relu dans le
// tenant (introuvable sinon), destinataires = SES comptes, jamais journalisée si rien
// n'est parti.

class RedirectError extends Error {}
class NotFoundError extends Error {}

const prismaMock = { prospect: { findFirst: vi.fn() } };
const requireCommercialSession = vi.fn();
const recordAuditEvent = vi.fn();
const send = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("@/lib/auth/guards", () => ({ requireCommercialSession: () => requireCommercialSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock("@/lib/email", () => ({ getEmailPort: () => ({ send }) }));
vi.mock("@/lib/config/app-url", () => ({ appUrl: (p: string) => `https://app.example.org${p}` }));
vi.mock("@/lib/db/read-prospect-pipeline", () => ({ readPipelineFacts: vi.fn() }));

const { remindSelfServiceProspect } = await import("./prospect-pipeline");

beforeEach(() => {
  vi.clearAllMocks();
  requireCommercialSession.mockResolvedValue({ tenantId: "tenant-1", userId: "u-1", role: "CABINET_COMMERCIAL" });
  prismaMock.prospect.findFirst.mockResolvedValue({
    id: "p-1",
    structureName: "SAD La Roseraie (fictif)",
    accounts: [{ user: { email: "direction@roseraie.example.org", name: "Claire (fictif)" } }],
  });
  send.mockResolvedValue("SENT");
});

describe("remindSelfServiceProspect", () => {
  it("relit le prospect dans le tenant de l'appelant, libre-service, non converti", async () => {
    await expect(remindSelfServiceProspect("p-1")).resolves.toBeNull();
    expect(prismaMock.prospect.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "p-1", tenantId: "tenant-1", channel: "LIBRE_SERVICE", establishmentId: null } })
    );
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "direction@roseraie.example.org" }));
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "PROSPECT_REMINDER_SENT", targetId: "p-1" }));
  });

  it("hors tenant ou démarché : introuvable", async () => {
    prismaMock.prospect.findFirst.mockResolvedValue(null);
    await expect(remindSelfServiceProspect("autre")).rejects.toBeInstanceOf(NotFoundError);
    expect(send).not.toHaveBeenCalled();
  });

  it("envoi non configuré : dit, jamais journalisé", async () => {
    send.mockResolvedValue("NOT_CONFIGURED");
    await expect(remindSelfServiceProspect("p-1")).resolves.toMatchObject({ error: expect.stringContaining("non envoyée") });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("refus de la garde : rien n'est lu", async () => {
    requireCommercialSession.mockRejectedValue(new RedirectError());
    await expect(remindSelfServiceProspect("p-1")).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.prospect.findFirst).not.toHaveBeenCalled();
  });
});
