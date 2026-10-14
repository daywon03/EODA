import { beforeEach, describe, expect, it, vi } from "vitest";

// Lectures du terrain (lot C) et MINIMISATION (décision de Damon, 14/10/2026) : le
// cabinet ne lit jamais la liste nominative des personnes accompagnées — ni par
// l'écran, ni par l'action, ni par le port.

const prismaMock = { establishment: { findUniqueOrThrow: vi.fn() } };
const guards = { requireEstablishmentAccess: vi.fn() };
const audit = vi.fn();
const port = {
  isAvailable: true,
  listBeneficiaries: vi.fn(),
  listBeneficiaryTimelines: vi.fn(),
  listBeneficiaryDocuments: vi.fn(),
  listSurveyResponses: vi.fn(),
};
class NotFoundError extends Error {}

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("@/lib/auth/guards", () => guards);
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: audit }));
vi.mock("@/lib/hds", () => ({ getBeneficiaryDataPort: () => port }));

const { buildSurveyExport, getPeopleAggregates, getPeopleBoard, getSurveyBoard } = await import("./terrain-read");

const CABINET_ACCESS = { establishmentId: "etab-1", userId: "u-cab", isClient: false, session: { user: { role: "CABINET_EVALUATOR" } } };
const CLIENT_ACCESS = { establishmentId: "etab-1", userId: "u-cli", isClient: true, session: { user: { role: "CLIENT_USER" } } };
const START = new Date("2026-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.establishment.findUniqueOrThrow.mockResolvedValue({ tenantId: "tenant-1", name: "SAD Les Glycines (fictif)" });
  port.listBeneficiaries.mockResolvedValue([
    {
      id: "b1",
      civility: null,
      firstName: "Prénom",
      lastName: "Fictif",
      address: "Adresse fictive",
      girLevel: 3,
      monthlyHours: 12,
      startedOn: START,
      endedOn: null,
      referentStaffMemberId: null,
      representative: null,
    },
  ]);
  port.listBeneficiaryTimelines.mockResolvedValue([{ id: "b1", startedOn: START, endedOn: null }]);
  port.listBeneficiaryDocuments.mockResolvedValue([]);
  port.listSurveyResponses.mockResolvedValue([]);
});

describe("getPeopleAggregates — onglet cabinet", () => {
  it("rend des chiffres, calculés sans jamais appeler la lecture nominative", async () => {
    guards.requireEstablishmentAccess.mockResolvedValue(CABINET_ACCESS);
    const result = await getPeopleAggregates("etab-1");

    expect(port.listBeneficiaries).not.toHaveBeenCalled();
    expect(port.listBeneficiaryTimelines).toHaveBeenCalledWith({ tenantId: "tenant-1", establishmentId: "etab-1" });
    expect(result.aggregates.activePeople).toBe(1);
    expect(result.aggregates.receptionToRenew).toBe(1);
    expect(JSON.stringify(result)).not.toMatch(/Fictif|Prénom|Adresse/);
  });

  it("refuse un identifiant vide ou hors périmètre (garde unique)", async () => {
    await expect(getPeopleAggregates("")).rejects.toBeInstanceOf(NotFoundError);
    guards.requireEstablishmentAccess.mockRejectedValue(new NotFoundError());
    await expect(getPeopleAggregates("etab-autre")).rejects.toBeInstanceOf(NotFoundError);
    expect(port.listBeneficiaryTimelines).not.toHaveBeenCalled();
  });
});

describe("getPeopleBoard — liste nominative de la structure", () => {
  it("est refusée à un compte cabinet, côté serveur, avant toute lecture", async () => {
    guards.requireEstablishmentAccess.mockResolvedValue(CABINET_ACCESS);
    await expect(getPeopleBoard("etab-1")).rejects.toBeInstanceOf(NotFoundError);
    expect(port.listBeneficiaries).not.toHaveBeenCalled();
  });

  it("est servie à la structure", async () => {
    guards.requireEstablishmentAccess.mockResolvedValue(CLIENT_ACCESS);
    const board = await getPeopleBoard("etab-1");
    expect(board.people).toEqual([{ id: "b1", name: "Prénom Fictif", girLevel: 3, monthlyHours: 12, surveyDone: false }]);
    expect(board.alerts.map((a) => [a.name, a.kind])).toEqual([["Prénom Fictif", "DIPC_A_REMETTRE"]]);
  });

  it("ne lit rien sans session (la garde redirige ou refuse)", async () => {
    guards.requireEstablishmentAccess.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(getPeopleBoard("etab-1")).rejects.toThrow("NEXT_REDIRECT");
    expect(port.listBeneficiaries).not.toHaveBeenCalled();
  });
});

describe("getSurveyBoard et export — statistiques", () => {
  it("le cabinet lit la couverture sans la lecture nominative", async () => {
    guards.requireEstablishmentAccess.mockResolvedValue(CABINET_ACCESS);
    const board = await getSurveyBoard("etab-1");
    expect(board.coverage).toEqual({ done: 0, total: 1, personne: 0, famille: 0 });
    expect(port.listBeneficiaries).not.toHaveBeenCalled();
  });

  it("l'export est journalisé sans contenu", async () => {
    guards.requireEstablishmentAccess.mockResolvedValue(CABINET_ACCESS);
    const { fileName } = await buildSurveyExport("etab-1");
    expect(fileName).toMatch(/ENQUETE/);
    expect(audit).toHaveBeenCalledWith({
      action: "SURVEY_RESULTS_EXPORTED",
      actorUserId: "u-cab",
      actorRole: "CABINET_EVALUATOR",
      establishmentId: "etab-1",
    });
  });
});
