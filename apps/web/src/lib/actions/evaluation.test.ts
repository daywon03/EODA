import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Rating } from "@eoda/database";

// Cas de REFUS de la cotation face au périmètre de critères de l'offre (D7).
// Règle de référence : .claude/context/07-outil-pilotage-missions.md §12.1 — en
// Essentiel, le périmètre audité est celui des 16 critères impératifs. La lecture
// (getEvaluationChapter) filtrait déjà ; l'écriture doit refuser la même chose,
// sans quoi un `evaluationElementId` obtenu autrement que par l'UI reste cotable.
// offer-scope-service et scoring-service sont exécutés pour de vrai : seules les
// frontières (base, cache, autorisation) sont doublées.

const prismaMock = {
  evaluationSession: { findFirst: vi.fn() },
  evaluationElement: { findUnique: vi.fn() },
  mission: { findUnique: vi.fn() },
  elementRating: { upsert: vi.fn() },
};

const requireCabinetSession = vi.fn();

vi.mock("@eoda/database", () => ({
  prisma: prismaMock,
  Rating: { R1: "R1", R2: "R2", R3: "R3", R4: "R4", STAR: "STAR", NC: "NC", RI: "RI" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/lib/auth/guards", () => ({
  requireCabinetSession: () => requireCabinetSession(),
  requireEstablishmentInTenant: vi.fn(),
}));

const { rateElement } = await import("./evaluation");

// Simule une valeur arrivant d'une requête HTTP : côté serveur, le type d'un
// paramètre d'action serveur ne prouve rien à l'exécution.
function untrustedRating(value: string): Rating {
  return value as Rating;
}

const SESSION_ID = "sess-1";
const OUT_OF_SCOPE =
  "Ce critère n'entre pas dans le périmètre de l'offre souscrite pour cet établissement.";

function givenElement(requirementLevel: "IMPERATIF" | "STANDARD"): void {
  prismaMock.evaluationElement.findUnique.mockResolvedValue({
    id: "ee-1",
    criterion: { requirementLevel },
  });
}

function givenMission(formule: string | null, gratuit = false): void {
  prismaMock.mission.findUnique.mockResolvedValue(
    formule === null ? null : { formule, gratuit }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireCabinetSession.mockResolvedValue({
    tenantId: "tenant-1",
    userId: "user-1",
    session: { user: { role: "CABINET_EVALUATOR" } },
  });
  prismaMock.evaluationSession.findFirst.mockResolvedValue({
    id: SESSION_ID,
    establishmentId: "etab-1",
    // Session OUVERTE par défaut : c'est l'état dans lequel on cote.
    finishedAt: null,
    chapter: { number: 3 },
  });
  prismaMock.elementRating.upsert.mockResolvedValue({});
});

describe("rateElement — périmètre de critères de l'offre", () => {
  it("refuse un critère standard en Essentiel payant, sans rien écrire", async () => {
    givenElement("STANDARD");
    givenMission("ESSENTIEL");

    await expect(rateElement(SESSION_ID, "ee-1", "R4", null)).resolves.toEqual({
      error: OUT_OF_SCOPE,
    });
    expect(prismaMock.elementRating.upsert).not.toHaveBeenCalled();
  });

  it("accepte un critère impératif en Essentiel payant", async () => {
    givenElement("IMPERATIF");
    givenMission("ESSENTIEL");

    await expect(rateElement(SESSION_ID, "ee-1", "R4", null)).resolves.toEqual({});
    expect(prismaMock.elementRating.upsert).toHaveBeenCalledTimes(1);
  });

  it("accepte un critère standard dès Performance et en bêta-test gratuit", async () => {
    for (const [formule, gratuit] of [
      ["PERFORMANCE", false],
      ["EXCELLENCE", false],
      ["BETA", false],
      ["ESSENTIEL", true],
    ] as const) {
      vi.clearAllMocks();
      prismaMock.evaluationSession.findFirst.mockResolvedValue({
        id: SESSION_ID,
        establishmentId: "etab-1",
        finishedAt: null,
        chapter: { number: 3 },
      });
      prismaMock.elementRating.upsert.mockResolvedValue({});
      requireCabinetSession.mockResolvedValue({
        tenantId: "tenant-1",
        userId: "user-1",
        session: { user: { role: "CABINET_EVALUATOR" } },
      });
      givenElement("STANDARD");
      givenMission(formule, gratuit);

      await expect(rateElement(SESSION_ID, "ee-1", "R3", null)).resolves.toEqual({});
      expect(prismaMock.elementRating.upsert).toHaveBeenCalledTimes(1);
    }
  });

  it("refuse toute cotation quand aucune mission n'est contractée (fail-closed)", async () => {
    givenElement("IMPERATIF");
    givenMission(null);

    await expect(rateElement(SESSION_ID, "ee-1", "R4", null)).resolves.toEqual({
      error: OUT_OF_SCOPE,
    });
    expect(prismaMock.elementRating.upsert).not.toHaveBeenCalled();
  });

  it("refuse une valeur de cotation inconnue avant toute lecture en base", async () => {
    await expect(
      rateElement(SESSION_ID, "ee-1", untrustedRating("A"), null)
    ).resolves.toEqual({ error: "Cotation invalide." });
    expect(prismaMock.evaluationSession.findFirst).not.toHaveBeenCalled();
  });

  it("conserve les règles HAS de cotation par-dessus le périmètre (RI hors chapitre 1)", async () => {
    givenElement("STANDARD");
    givenMission("EXCELLENCE");

    await expect(rateElement(SESSION_ID, "ee-1", "RI", null)).resolves.toEqual({
      error: "RI n'est disponible que pour le Chapitre 1.",
    });
    expect(prismaMock.elementRating.upsert).not.toHaveBeenCalled();
  });
});

describe("rateElement — session clôturée", () => {
  it("refuse de coter dans une session clôturée, sans rien écrire", async () => {
    // Une session close est la PHOTO d'un état à une date. La réécrire ferait dériver
    // la première auto-évaluation pendant qu'on mène la seconde, et la comparaison
    // des deux (§12.6, offre Excellence) ne voudrait plus rien dire.
    prismaMock.evaluationSession.findFirst.mockResolvedValue({
      id: SESSION_ID,
      establishmentId: "etab-1",
      finishedAt: new Date("2026-08-20T10:00:00Z"),
      chapter: { number: 3 },
    });
    givenElement("IMPERATIF");
    givenMission("EXCELLENCE");

    const result = await rateElement(SESSION_ID, "ee-1", untrustedRating("R4"), null);

    expect(result).toEqual({
      error: "Cette session est clôturée. Ouvrez une nouvelle session pour coter.",
    });
    expect(prismaMock.elementRating.upsert).not.toHaveBeenCalled();
  });
});
