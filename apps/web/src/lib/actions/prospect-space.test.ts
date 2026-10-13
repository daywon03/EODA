import { beforeEach, describe, expect, it, vi } from "vitest";

// Espace d'une structure inscrite seule : chaque action passe par la garde prospect
// (le prospect vient du lien, jamais d'un identifiant reçu) ; un critère hors profil
// est introuvable ; « Être accompagné » crée un rendez-vous DEMANDE et alerte le cabinet.

class RedirectError extends Error {}
class NotFoundError extends Error {}

const tx = { appointment: { updateMany: vi.fn(), create: vi.fn() } };
const prismaMock = {
  prospectPracticeAnswer: { create: vi.fn() },
  appointment: { findFirst: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn((run: (t: typeof tx) => unknown) => run(tx)),
};
const requireProspectSession = vi.fn();
const recordAuditEvent = vi.fn();
const send = vi.fn();

const PROSPECT = {
  id: "prospect-1",
  tenantId: "tenant-1",
  structureName: "SAD Les Coquelicots (fictif)",
  establishmentType: "SAD_AIDE",
  envisagedFormule: "ESSENTIEL",
  establishmentId: null,
};
const IMPERATIVES = [
  { id: "crit-1", code: "3.12.1", label: "Plaintes", expectedDocuments: [{ id: "d1", label: "Registre des plaintes" }] },
  { id: "crit-2", code: "2.2.6", label: "Droits", expectedDocuments: [{ id: "d2", label: "Livret d'accueil" }] },
];

vi.mock("@eoda/database", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new NotFoundError();
  },
}));
vi.mock("@/lib/auth/guards", () => ({ requireProspectSession: () => requireProspectSession() }));
vi.mock("@/lib/services/audit-log-service", () => ({ recordAuditEvent: (...a: unknown[]) => recordAuditEvent(...a) }));
vi.mock("@/lib/email", () => ({ getEmailPort: () => ({ send }) }));
vi.mock("@/lib/config/app-url", () => ({ appUrl: (p: string) => `https://app.example.org${p}` }));
vi.mock("@/lib/db/read-prospect-diagnostic", () => ({
  readImperativesByType: () => Promise.resolve({ SAD_AIDE: IMPERATIVES, SAD_MIXTE: IMPERATIVES }),
  readProspectAnswers: () =>
    Promise.resolve(
      new Map([
        [
          "prospect-1",
          {
            latest: new Map([["crit-1", { criterionId: "crit-1", questionVersion: 1, answer: "PAS_ENCORE", text: null, answeredAt: new Date() }]]),
            lastAnswerAt: new Date(),
          },
        ],
      ])
    ),
}));

const { getProspectSpace, requestAccompaniment, saveProspectPracticeAnswer } = await import("./prospect-space");

function day(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireProspectSession.mockResolvedValue({ prospect: PROSPECT, userId: "user-1", session: { user: { name: "Nadia (fictif)" } } });
  prismaMock.appointment.findFirst.mockResolvedValue(null);
  prismaMock.user.findMany.mockResolvedValue([{ email: "commercial@eoda.example.org" }]);
  send.mockResolvedValue("SENT");
});

describe("garde", () => {
  it("toute action refuse un appelant que la garde renvoie", async () => {
    requireProspectSession.mockRejectedValue(new RedirectError("/dashboard/client"));
    await expect(getProspectSpace()).rejects.toBeInstanceOf(RedirectError);
    await expect(saveProspectPracticeAnswer({ criterionId: "crit-1", answer: "OUI", text: "" })).rejects.toBeInstanceOf(RedirectError);
    await expect(requestAccompaniment({ status: "IDLE" }, form({ day: day(3), moment: "MATIN" }))).rejects.toBeInstanceOf(RedirectError);
    expect(prismaMock.prospectPracticeAnswer.create).not.toHaveBeenCalled();
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });
});

describe("getProspectSpace", () => {
  it("avancement et liste de travail dérivés des réponses de CE prospect", async () => {
    const space = await getProspectSpace();
    expect(space.progress).toMatchObject({ answered: 1, total: 2, stage: "IN_PROGRESS" });
    expect(space.workList.map((w) => w.label)).toEqual(["Registre des plaintes"]);
    expect(space.signed).toBe(false);
  });
});

describe("saveProspectPracticeAnswer", () => {
  it("enregistre une réponse rattachée au prospect du lien, journal sans le texte", async () => {
    await expect(saveProspectPracticeAnswer({ criterionId: "crit-2", answer: "OUI", text: "Une phrase libre" })).resolves.toBeNull();
    expect(prismaMock.prospectPracticeAnswer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ prospectId: "prospect-1", criterionId: "crit-2", answer: "OUI", answeredById: "user-1" }),
    });
    expect(JSON.stringify(recordAuditEvent.mock.calls)).not.toContain("Une phrase libre");
  });

  it("critère hors des impératifs du profil : introuvable", async () => {
    await expect(saveProspectPracticeAnswer({ criterionId: "crit-autre", answer: "OUI", text: "" })).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.prospectPracticeAnswer.create).not.toHaveBeenCalled();
  });

  it("réponse hors liste : refusée sans écrire", async () => {
    await expect(saveProspectPracticeAnswer({ criterionId: "crit-1", answer: "PEUT_ETRE", text: "" })).resolves.toMatchObject({ error: expect.any(String) });
    expect(prismaMock.prospectPracticeAnswer.create).not.toHaveBeenCalled();
  });
});

describe("requestAccompaniment — « Être accompagné »", () => {
  it("crée un appel découverte DEMANDE lié au prospect et alerte le cabinet", async () => {
    const state = await requestAccompaniment({ status: "IDLE" }, form({ day: day(3), moment: "MATIN", message: "Le plan de continuité" }));
    expect(state).toEqual({ status: "DONE" });
    expect(tx.appointment.updateMany).toHaveBeenCalledWith({
      where: { prospectId: "prospect-1", kind: "R1_DECOUVERTE", status: "DEMANDE" },
      data: { status: "ANNULE" },
    });
    expect(tx.appointment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        prospectId: "prospect-1",
        kind: "R1_DECOUVERTE",
        status: "DEMANDE",
        notes: "Le plan de continuité",
        createdByUserId: "user-1",
      }),
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "ACCOMPANIMENT_REQUESTED", targetId: "prospect-1" }));
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-1", role: { in: ["CABINET_ADMIN", "CABINET_COMMERCIAL"] } }) })
    );
    expect(send).toHaveBeenCalledTimes(1);
    // Le message de la structure ne part pas par e-mail.
    expect(JSON.stringify(send.mock.calls)).not.toContain("plan de continuité");
  });

  it("jour invalide : refus, rien n'est créé", async () => {
    const state = await requestAccompaniment({ status: "IDLE" }, form({ day: day(0), moment: "MATIN" }));
    expect(state.status).toBe("ERROR");
    expect(tx.appointment.create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("une alerte qui échoue ne défait pas la demande", async () => {
    send.mockRejectedValue(new Error("SMTP"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(requestAccompaniment({ status: "IDLE" }, form({ day: day(3), moment: "APRES_MIDI" }))).resolves.toEqual({ status: "DONE" });
    errorSpy.mockRestore();
  });
});
