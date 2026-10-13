import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateQuizToken, hashQuizToken } from "@/lib/security/quiz-token";

// Route publique du quiz : jeton mal formé (aucune lecture), débit, empreinte
// inconnue, expiré, réutilisé, réponses jamais livrées avant la fin, usage unique
// atomique, score calculé par le serveur.

const tx = { quizInvitation: { updateMany: vi.fn() }, quizAttempt: { create: vi.fn() } };
const prismaMock = {
  quizInvitation: { findUnique: vi.fn() },
  $transaction: vi.fn((run: (t: typeof tx) => unknown) => run(tx)),
};
const consumeThrottledAttempt = vi.fn();
const recordAuditEvent = vi.fn();

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.9" })) }));
vi.mock("@/lib/security/attempt-throttle", () => ({
  consumeThrottledAttempt: (...args: unknown[]) => consumeThrottledAttempt(...args),
}));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { openPublicQuiz, submitPublicQuiz } = await import("./quiz-public");
const { PLAINTES_QUIZ } = await import("@/content/quiz/plaintes");

const TOKEN = generateQuizToken();
const FUTURE = new Date(Date.now() + 3600_000);

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    tokenHash: hashQuizToken(TOKEN),
    staffMemberId: "staff-1",
    expiresAt: FUTURE,
    usedAt: null,
    campaign: {
      tenantId: "t-1",
      establishmentId: "e-1",
      moduleCode: "PLAINTES",
      establishment: { name: "SAD Les Glycines (fictif)" },
    },
    ...overrides,
  };
}

const ALL_RIGHT = Object.fromEntries(PLAINTES_QUIZ.questions.map((q) => [q.id, q.correctChoiceId]));

beforeEach(() => {
  vi.clearAllMocks();
  consumeThrottledAttempt.mockResolvedValue(true);
  prismaMock.quizInvitation.findUnique.mockResolvedValue(invitation());
  tx.quizInvitation.updateMany.mockResolvedValue({ count: 1 });
  tx.quizAttempt.create.mockResolvedValue({ id: "att-1" });
});

describe("openPublicQuiz", () => {
  it("jeton mal formé : refus sans lecture ni consommation de débit", async () => {
    await expect(openPublicQuiz("pas-un-jeton")).resolves.toEqual({ state: "INVALID" });
    expect(prismaMock.quizInvitation.findUnique).not.toHaveBeenCalled();
    expect(consumeThrottledAttempt).not.toHaveBeenCalled();
  });

  it("débit dépassé : refus avant la base, compteur indexé sur l'IP", async () => {
    consumeThrottledAttempt.mockResolvedValue(false);
    await expect(openPublicQuiz(TOKEN)).resolves.toEqual({ state: "RATE_LIMITED" });
    expect(prismaMock.quizInvitation.findUnique).not.toHaveBeenCalled();
    expect(consumeThrottledAttempt).toHaveBeenCalledWith(expect.objectContaining({ key: "quiz:203.0.113.9" }));
  });

  it("cherche par EMPREINTE, jamais par le jeton en clair", async () => {
    await openPublicQuiz(TOKEN);
    expect(prismaMock.quizInvitation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashQuizToken(TOKEN) } })
    );
  });

  it("empreinte inconnue ou différente : même refus", async () => {
    prismaMock.quizInvitation.findUnique.mockResolvedValue(null);
    await expect(openPublicQuiz(TOKEN)).resolves.toEqual({ state: "INVALID" });
    prismaMock.quizInvitation.findUnique.mockResolvedValue(invitation({ tokenHash: hashQuizToken(generateQuizToken()) }));
    await expect(openPublicQuiz(TOKEN)).resolves.toEqual({ state: "INVALID" });
  });

  it("expiré, déjà utilisé", async () => {
    prismaMock.quizInvitation.findUnique.mockResolvedValue(invitation({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(openPublicQuiz(TOKEN)).resolves.toEqual({ state: "EXPIRED" });
    prismaMock.quizInvitation.findUnique.mockResolvedValue(invitation({ usedAt: new Date() }));
    await expect(openPublicQuiz(TOKEN)).resolves.toEqual({ state: "USED" });
  });

  it("valide : le nom de la structure et le quiz, SANS les bonnes réponses ni les explications", async () => {
    const view = await openPublicQuiz(TOKEN);
    expect(view).toMatchObject({ state: "VALID", establishmentName: "SAD Les Glycines (fictif)" });
    const text = JSON.stringify(view);
    expect(text).not.toContain("correctChoiceId");
    expect(text).not.toContain("explanation");
    expect(text).not.toContain("staff-1");
  });
});

describe("submitPublicQuiz", () => {
  it("enregistre la tentative, pose l'usage unique atomiquement, journalise", async () => {
    const result = await submitPublicQuiz(TOKEN, ALL_RIGHT);
    expect(result).toMatchObject({ state: "DONE", passed: true, score: PLAINTES_QUIZ.questions.length });
    expect(tx.quizInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "inv-1", usedAt: null }) })
    );
    expect(tx.quizAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ staffMemberId: "staff-1", moduleCode: "PLAINTES", moduleVersion: PLAINTES_QUIZ.version, passed: true }),
      })
    );
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "QUIZ_ATTEMPT_COMPLETED" }));
  });

  it("deux envois simultanés : le second est refusé comme déjà utilisé", async () => {
    tx.quizInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(submitPublicQuiz(TOKEN, ALL_RIGHT)).resolves.toEqual({ state: "USED" });
    expect(tx.quizAttempt.create).not.toHaveBeenCalled();
  });

  it("un quiz incomplet n'est pas enregistré", async () => {
    await expect(submitPublicQuiz(TOKEN, { "pl-1": "a" })).resolves.toEqual({ state: "INCOMPLETE" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("le score ne vient jamais du navigateur", async () => {
    const wrong = Object.fromEntries(
      PLAINTES_QUIZ.questions.map((q) => [q.id, q.choices.find((c) => c.id !== q.correctChoiceId)?.id ?? "a"])
    );
    const result = await submitPublicQuiz(TOKEN, { ...wrong, score: 99, passed: true });
    expect(result).toMatchObject({ state: "DONE", score: 0, passed: false });
  });

  it("jeton expiré à l'envoi : refus", async () => {
    prismaMock.quizInvitation.findUnique.mockResolvedValue(invitation({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(submitPublicQuiz(TOKEN, ALL_RIGHT)).resolves.toEqual({ state: "EXPIRED" });
  });
});
