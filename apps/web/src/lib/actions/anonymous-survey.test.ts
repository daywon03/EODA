import { beforeEach, describe, expect, it, vi } from "vitest";
import { SURVEY_SCALES, surveyTemplateFor } from "@/content/enquete";
import { anonymousQuestions } from "@/lib/services/anonymous-survey-service";
import { generateOneTimeToken, hashOneTimeToken } from "@/lib/security/one-time-token";

// Enquête anonyme : ce que les actions écrivent, et surtout ce qu'elles n'écrivent pas.

const prismaMock = {
  anonymousSurveyInvite: { findUnique: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
  anonymousSurveyResponse: { create: vi.fn() },
  establishment: { findUniqueOrThrow: vi.fn() },
  $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prismaMock)),
};
const resolveTabletSession = vi.fn();
const requireEstablishmentAccess = vi.fn();
const consumeThrottledAttempt = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  resolveTabletSession: () => resolveTabletSession(),
  requireEstablishmentAccess: (...args: unknown[]) => requireEstablishmentAccess(...args),
}));
vi.mock("@/lib/security/attempt-throttle", () => ({
  consumeThrottledAttempt: (...args: unknown[]) => consumeThrottledAttempt(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { createAnonymousSurveyLinks, submitAnonymousSurveyLink, submitTabletAnonymousSurvey } = await import("./anonymous-survey");

function answersJson(): string {
  const template = surveyTemplateFor("PERSONNE");
  return JSON.stringify(
    Object.fromEntries(anonymousQuestions(template).map((q) => [q.id, SURVEY_SCALES[q.scale].options[0]!.choice]))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  consumeThrottledAttempt.mockResolvedValue(true);
});

describe("submitAnonymousSurveyLink", () => {
  const token = generateOneTimeToken();
  function givenInvite(over: Partial<{ usedAt: Date | null; expiresAt: Date }> = {}) {
    prismaMock.anonymousSurveyInvite.findUnique.mockResolvedValue({
      id: "inv-1",
      tenantId: "t-1",
      establishmentId: "e-1",
      templateCode: "PERSONNE",
      tokenHash: hashOneTimeToken(token),
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
      establishment: { name: "SAD fictif" },
      ...over,
    });
  }

  it("consomme le lien ATOMIQUEMENT, puis écrit une réponse sans personne ni texte", async () => {
    givenInvite();
    prismaMock.anonymousSurveyInvite.updateMany.mockResolvedValue({ count: 1 });
    expect(await submitAnonymousSurveyLink(token, answersJson())).toEqual({ state: "DONE" });

    expect(prismaMock.anonymousSurveyInvite.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "inv-1", usedAt: null }) })
    );
    const data = prismaMock.anonymousSurveyResponse.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ tenantId: "t-1", establishmentId: "e-1", channel: "LIEN", mode: "SEULE", respondentKind: "PERSONNE" });
    expect(Object.keys(data).sort()).toEqual(
      ["answers", "channel", "completedOn", "establishmentId", "mode", "respondentKind", "templateCode", "templateVersion", "tenantId"].sort()
    );
    // Une réponse anonyme n'est jamais journalisée.
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("deux envois simultanés : le second voit le lien déjà pris", async () => {
    givenInvite();
    prismaMock.anonymousSurveyInvite.updateMany.mockResolvedValue({ count: 0 });
    expect(await submitAnonymousSurveyLink(token, answersJson())).toEqual({ state: "USED" });
    expect(prismaMock.anonymousSurveyResponse.create).not.toHaveBeenCalled();
  });

  it("refuse sans lire la base un jeton mal formé, et un lien déjà utilisé ou expiré", async () => {
    expect(await submitAnonymousSurveyLink("court", answersJson())).toEqual({ state: "INVALID" });
    expect(prismaMock.anonymousSurveyInvite.findUnique).not.toHaveBeenCalled();
    givenInvite({ usedAt: new Date() });
    expect(await submitAnonymousSurveyLink(token, answersJson())).toEqual({ state: "USED" });
    givenInvite({ expiresAt: new Date(Date.now() - 1000) });
    expect(await submitAnonymousSurveyLink(token, answersJson())).toEqual({ state: "EXPIRED" });
  });

  it("limite le débit par adresse IP", async () => {
    consumeThrottledAttempt.mockResolvedValue(false);
    expect(await submitAnonymousSurveyLink(token, answersJson())).toEqual({ state: "RATE_LIMITED" });
    expect(consumeThrottledAttempt).toHaveBeenCalledWith(expect.objectContaining({ key: "enquete:203.0.113.7" }));
  });

  it("des réponses invalides n'utilisent pas le lien", async () => {
    givenInvite();
    const result = await submitAnonymousSurveyLink(token, JSON.stringify({ "p13-message": "texte" }));
    expect(result).toMatchObject({ state: "ERROR" });
    expect(prismaMock.anonymousSurveyInvite.updateMany).not.toHaveBeenCalled();
  });
});

describe("submitTabletAnonymousSurvey", () => {
  function form(mode = "ASSISTEE"): FormData {
    const data = new FormData();
    data.set("templateCode", "PERSONNE");
    data.set("mode", mode);
    data.set("answers", answersJson());
    return data;
  }

  it("exige la tablette enregistrée ET le salarié connecté", async () => {
    resolveTabletSession.mockResolvedValue(null);
    expect(await submitTabletAnonymousSurvey(form())).toMatchObject({ error: expect.stringContaining("session") });
    expect(prismaMock.anonymousSurveyResponse.create).not.toHaveBeenCalled();
  });

  it("n'enregistre PAS le salarié avec la réponse", async () => {
    resolveTabletSession.mockResolvedValue({ tenantId: "t-1", establishmentId: "e-1", staffMemberId: "s-9", staffDisplayName: "X" });
    expect(await submitTabletAnonymousSurvey(form())).toEqual({ ok: true });
    const data = prismaMock.anonymousSurveyResponse.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ channel: "TABLETTE", mode: "ASSISTEE", establishmentId: "e-1" });
    expect(JSON.stringify(data)).not.toContain("s-9");
  });

  it("refuse un mode inconnu", async () => {
    resolveTabletSession.mockResolvedValue({ tenantId: "t-1", establishmentId: "e-1", staffMemberId: "s-9", staffDisplayName: "X" });
    expect(await submitTabletAnonymousSurvey(form("AUTRE"))).toMatchObject({ error: expect.any(String) });
  });
});

describe("createAnonymousSurveyLinks", () => {
  it("garde TERRAIN_WRITE, ne stocke que des empreintes, rend les jetons une fois", async () => {
    requireEstablishmentAccess.mockResolvedValue({
      establishmentId: "e-1",
      userId: "u-1",
      isClient: true,
      missionAccess: "ACTIVE",
      session: { user: { role: "CLIENT_USER" } },
    });
    prismaMock.establishment.findUniqueOrThrow.mockResolvedValue({ tenantId: "t-1" });
    const data = new FormData();
    data.set("establishmentId", "e-1");
    data.set("templateCode", "FAMILLE");
    data.set("count", "3");

    const result = await createAnonymousSurveyLinks(data);
    expect(requireEstablishmentAccess).toHaveBeenCalledWith("e-1", expect.objectContaining({ module: "TERRAIN", mode: "WRITE" }));
    if ("error" in result) throw new Error(result.error);
    expect(result.tokens).toHaveLength(3);
    const rows = prismaMock.anonymousSurveyInvite.createMany.mock.calls[0]![0].data as { tokenHash: string }[];
    expect(rows.map((r) => r.tokenHash)).toEqual(result.tokens.map(hashOneTimeToken));
    expect(JSON.stringify(rows)).not.toContain(result.tokens[0]!);
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ANONYMOUS_SURVEY_LINKS_CREATED", detail: "FAMILLE · 3" }));
  });

  it("refuse un nombre de liens hors bornes", async () => {
    requireEstablishmentAccess.mockResolvedValue({ establishmentId: "e-1", userId: "u-1", isClient: true, missionAccess: "ACTIVE", session: { user: { role: "CLIENT_USER" } } });
    const data = new FormData();
    data.set("establishmentId", "e-1");
    data.set("templateCode", "PERSONNE");
    data.set("count", "500");
    expect(await createAnonymousSurveyLinks(data)).toMatchObject({ error: expect.any(String) });
    expect(prismaMock.anonymousSurveyInvite.createMany).not.toHaveBeenCalled();
  });
});
