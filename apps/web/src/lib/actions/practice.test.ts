import { beforeEach, describe, expect, it, vi } from "vitest";

// Réponses aux questions sur les pratiques (N7). Ce qui est protégé : seule la
// structure répond, sur SA structure ; le critère doit être un impératif de cette
// structure ; la réponse est validée, la version relue côté serveur ; le journal ne
// recopie jamais le texte libre ; mission close = lecture seule.

const prismaMock = {
  practiceAnswer: { create: vi.fn(), findMany: vi.fn() },
  documentType: { findMany: vi.fn() },
};
const requireClientEstablishment = vi.fn();
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
vi.mock("@/lib/auth/guards", () => ({ requireClientEstablishment: () => requireClientEstablishment() }));
vi.mock("@/lib/db/read-diagnostic", () => ({ readDiagnostic: (id: string) => readDiagnostic(id) }));
vi.mock("@/lib/services/audit-log-service", () => ({
  recordAuditEvent: (...args: unknown[]) => recordAuditEvent(...args),
}));

const { getClientPractices, savePracticeAnswer } = await import("./practice");

const ETAB = "etab-fictif";
const CLIENT = { userId: "user-client", session: { user: { role: "CLIENT_USER" } }, establishment: { id: ETAB }, missionAccess: "ACTIVE" };
const row = (code: string, isImperative = true) => ({
  id: `c-${code}`,
  code,
  label: `Intitulé ${code}`,
  chapterNumber: 3,
  isImperative,
  expectedDocumentTypeIds: ["t-plaintes"],
  status: "SANS_PREUVE",
  expected: 1,
  deposited: 0,
  proven: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireClientEstablishment.mockResolvedValue(CLIENT);
  readDiagnostic.mockResolvedValue({ rows: [row("3.12.1"), row("3.14.1"), row("1.1.1", false)] });
  prismaMock.practiceAnswer.create.mockResolvedValue({});
  prismaMock.practiceAnswer.findMany.mockResolvedValue([]);
  prismaMock.documentType.findMany.mockResolvedValue([{ id: "t-plaintes", label: "Procédure plaintes" }]);
});

describe("savePracticeAnswer", () => {
  it("enregistre la réponse sous la version courante, journalise sans le texte", async () => {
    const result = await savePracticeAnswer({ criterionId: "c-3.12.1", answer: "EN_PARTIE", text: "On note dans un cahier." });
    expect(result).toBeNull();
    expect(prismaMock.practiceAnswer.create).toHaveBeenCalledWith({
      data: {
        establishmentId: ETAB,
        criterionId: "c-3.12.1",
        questionVersion: 1,
        answer: "EN_PARTIE",
        text: "On note dans un cahier.",
        answeredById: "user-client",
      },
    });
    const audit = recordAuditEvent.mock.calls[0]?.[0] as { action: string; detail: string };
    expect(audit.action).toBe("PRACTICE_ANSWER_SAVED");
    expect(audit.detail).toBe("3.12.1 → EN_PARTIE");
    expect(JSON.stringify(audit)).not.toContain("cahier");
  });

  it.each([undefined, "", "CONFORME", "oui"])("refuse une réponse invalide (%s)", async (answer) => {
    expect(await savePracticeAnswer({ criterionId: "c-3.12.1", answer, text: "" })).toEqual({ error: expect.any(String) });
    expect(prismaMock.practiceAnswer.create).not.toHaveBeenCalled();
  });

  it("refuse un texte trop long", async () => {
    const result = await savePracticeAnswer({ criterionId: "c-3.12.1", answer: "OUI", text: "x".repeat(5000) });
    expect(result).toEqual({ error: expect.stringMatching(/trop long/) });
  });

  it("un critère standard, inconnu ou d'une autre structure : introuvable", async () => {
    await expect(savePracticeAnswer({ criterionId: "c-1.1.1", answer: "OUI", text: null })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(savePracticeAnswer({ criterionId: "c-autre", answer: "OUI", text: null })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(savePracticeAnswer({ criterionId: 42, answer: "OUI", text: null })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prismaMock.practiceAnswer.create).not.toHaveBeenCalled();
  });

  it("mission close : lecture seule", async () => {
    requireClientEstablishment.mockResolvedValue({ ...CLIENT, missionAccess: "LIBRARY" });
    expect(await savePracticeAnswer({ criterionId: "c-3.12.1", answer: "OUI", text: null })).toEqual({
      error: expect.stringMatching(/terminé/),
    });
    expect(prismaMock.practiceAnswer.create).not.toHaveBeenCalled();
  });

  it("sans structure rattachée (ou cabinet, que la garde renvoie ailleurs) : introuvable", async () => {
    requireClientEstablishment.mockResolvedValue({ ...CLIENT, establishment: null });
    await expect(savePracticeAnswer({ criterionId: "c-3.12.1", answer: "OUI", text: null })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("getClientPractices", () => {
  it("une question par impératif, documents liés et progression", async () => {
    prismaMock.practiceAnswer.findMany.mockResolvedValue([
      { criterionId: "c-3.12.1", questionVersion: 1, answer: "OUI", text: null, answeredAt: new Date() },
    ]);
    const practices = await getClientPractices();
    expect(practices?.questions.map((q) => q.criterionCode)).toEqual(["3.12.1", "3.14.1"]);
    expect(practices?.questions[0]?.linkedDocuments).toBe("Document lié : Procédure plaintes — sans preuve.");
    expect(practices?.progress.label).toBe("1 réponse sur 2");
    expect(practices?.canAnswer).toBe(true);
    expect(prismaMock.practiceAnswer.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { establishmentId: ETAB } }));
  });

  it("une réponse sous une ancienne formulation est signalée à revoir", async () => {
    prismaMock.practiceAnswer.findMany.mockResolvedValue([
      { criterionId: "c-3.14.1", questionVersion: 0, answer: "OUI", text: null, answeredAt: new Date() },
    ]);
    const practices = await getClientPractices();
    expect(practices?.questions[1]?.outdated).toBe(true);
    expect(practices?.progress.answered).toBe(0);
  });

  it("sans structure : rien", async () => {
    requireClientEstablishment.mockResolvedValue({ ...CLIENT, establishment: null });
    expect(await getClientPractices()).toBeNull();
    readDiagnostic.mockResolvedValue(null);
    requireClientEstablishment.mockResolvedValue(CLIENT);
    expect(await getClientPractices()).toBeNull();
  });
});
