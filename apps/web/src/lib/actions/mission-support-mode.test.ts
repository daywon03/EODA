import { beforeEach, describe, expect, it, vi } from "vitest";

// Passage d'une mission en autonomie / accompagnement (N1) : CABINET_ADMIN seul, dans
// son tenant, valeur validée, geste journalisé.

const prismaMock = { mission: { findFirst: vi.fn(), update: vi.fn() } };
const requireCabinetAdminSession = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetAdminSession: () => requireCabinetAdminSession(),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { setMissionSupportMode } = await import("./mission-support-mode");

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetAdminSession.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "admin-1",
    session: { user: { role: "CABINET_ADMIN" } },
  });
  prismaMock.mission.findFirst.mockResolvedValue({ id: "m-1", establishmentId: "etab-1", supportMode: "ACCOMPAGNE" });
  prismaMock.mission.update.mockResolvedValue({});
});

describe("setMissionSupportMode", () => {
  it("passe la mission en autonomie, filtrée par tenant, et le journalise", async () => {
    expect(await setMissionSupportMode("m-1", "AUTONOMIE")).toBeNull();
    expect(prismaMock.mission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "m-1", tenantId: "tenant-1" } })
    );
    expect(prismaMock.mission.update).toHaveBeenCalledWith({ where: { id: "m-1" }, data: { supportMode: "AUTONOMIE" } });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "MISSION_SUPPORT_MODE_CHANGED", targetId: "m-1", detail: "AUTONOMIE" })
    );
  });

  it("ne réécrit rien quand le mode est déjà celui-là", async () => {
    expect(await setMissionSupportMode("m-1", "ACCOMPAGNE")).toBeNull();
    expect(prismaMock.mission.update).not.toHaveBeenCalled();
  });

  it("refuse une valeur inconnue, sans lire la mission", async () => {
    expect(await setMissionSupportMode("m-1", "SEUL")).toEqual({ error: "Mode invalide." });
    expect(prismaMock.mission.findFirst).not.toHaveBeenCalled();
  });

  it("répond notFound pour une mission d'un autre tenant", async () => {
    prismaMock.mission.findFirst.mockResolvedValue(null);
    await expect(setMissionSupportMode("m-autre", "AUTONOMIE")).rejects.toThrow();
    expect(prismaMock.mission.update).not.toHaveBeenCalled();
  });

  it("propage le refus de la garde admin (évaluateur, client, non connecté)", async () => {
    requireCabinetAdminSession.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(setMissionSupportMode("m-1", "AUTONOMIE")).rejects.toThrow("NEXT_REDIRECT");
    expect(prismaMock.mission.findFirst).not.toHaveBeenCalled();
  });
});
