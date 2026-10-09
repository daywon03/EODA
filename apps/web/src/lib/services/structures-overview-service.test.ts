import { describe, expect, it } from "vitest";
import {
  buildGreetingSummary,
  daysUntilEvaluation,
  deriveWatchReasons,
  describeLastActivity,
  describeLoi2002Coverage,
  firstNameOf,
  isFollowed,
  selectWatchList,
  sortByUrgency,
  type StructureFacts,
} from "./structures-overview-service";

const NOW = new Date(2026, 9, 9, 9, 0);
const inDays = (n: number) => new Date(2026, 9, 9 + n, 12, 0);

const facts = (over: Partial<StructureFacts> = {}): StructureFacts => ({
  id: "e1",
  name: "SAD Les Glycines (fictif)",
  type: "SAD_AIDE",
  stage: "EN_COURS",
  isBeta: false,
  hasEvaluationTargetDate: inDays(200),
  lastActivityAt: inDays(-1),
  documentsAwaitingReview: 0,
  hasUnansweredMessage: false,
  loi2002Deposited: 4,
  loi2002Total: 7,
  ...over,
});

const kinds = (row: StructureFacts) => deriveWatchReasons(row, NOW).map((r) => r.kind);

describe("deriveWatchReasons (motif « à surveiller »)", () => {
  it("rien à signaler : aucun motif", () => {
    expect(deriveWatchReasons(facts(), NOW)).toEqual([]);
  });

  it("échéance HAS à moins de 90 jours", () => {
    expect(deriveWatchReasons(facts({ hasEvaluationTargetDate: inDays(86) }), NOW)).toEqual([
      { kind: "ECHEANCE_PROCHE", label: "Évaluation HAS dans 86 jours" },
    ]);
    expect(kinds(facts({ hasEvaluationTargetDate: inDays(91) }))).toEqual([]);
  });

  it("échéance dépassée sans clôture de mission", () => {
    expect(kinds(facts({ hasEvaluationTargetDate: inDays(-3) }))).toEqual(["ECHEANCE_DEPASSEE"]);
  });

  it("documents à relire, accordés", () => {
    expect(deriveWatchReasons(facts({ documentsAwaitingReview: 1 }), NOW)[0]?.label).toBe("1 document à relire");
    expect(deriveWatchReasons(facts({ documentsAwaitingReview: 5 }), NOW)[0]?.label).toBe("5 documents à relire");
  });

  it("message sans réponse", () => {
    expect(kinds(facts({ hasUnansweredMessage: true }))).toEqual(["MESSAGE"]);
  });

  it("inactivité : trois semaines sans trace, ou aucune trace du tout", () => {
    expect(deriveWatchReasons(facts({ lastActivityAt: inDays(-21) }), NOW)[0]?.label).toBe(
      "Aucune activité depuis 21 jours"
    );
    expect(kinds(facts({ lastActivityAt: inDays(-20) }))).toEqual([]);
    expect(kinds(facts({ lastActivityAt: null }))).toEqual(["INACTIVITE"]);
  });

  it("plusieurs motifs : le plus grave d'abord", () => {
    expect(
      kinds(
        facts({ lastActivityAt: null, hasUnansweredMessage: true, documentsAwaitingReview: 2, hasEvaluationTargetDate: inDays(10) })
      )
    ).toEqual(["ECHEANCE_PROCHE", "A_RELIRE", "MESSAGE", "INACTIVITE"]);
  });

  it("mission terminée : plus rien à surveiller", () => {
    expect(isFollowed(facts({ stage: "TERMINE" }))).toBe(false);
    expect(kinds(facts({ stage: "TERMINE", documentsAwaitingReview: 3, lastActivityAt: null }))).toEqual([]);
  });
});

describe("sortByUrgency (tri de la liste des structures)", () => {
  it("échéance la plus proche d'abord, sans date ensuite, terminées à la fin", () => {
    const rows = [
      facts({ id: "done", stage: "TERMINE", hasEvaluationTargetDate: inDays(1) }),
      facts({ id: "nodate", hasEvaluationTargetDate: null }),
      facts({ id: "far", hasEvaluationTargetDate: inDays(300) }),
      facts({ id: "late", hasEvaluationTargetDate: inDays(-5) }),
      facts({ id: "soon", hasEvaluationTargetDate: inDays(20) }),
    ];
    expect(sortByUrgency(rows, NOW).map((r) => r.id)).toEqual(["late", "soon", "far", "nodate", "done"]);
    expect(rows[0]?.id).toBe("done");
  });

  it("à échéance égale, par nom", () => {
    const rows = [facts({ id: "b", name: "SAD Les Tilleuls (fictif)" }), facts({ id: "a", name: "SAD Les Aulnes (fictif)" })];
    expect(sortByUrgency(rows, NOW).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("deux structures sans date : par nom", () => {
    const rows = [
      facts({ id: "b", name: "B", hasEvaluationTargetDate: null }),
      facts({ id: "a", name: "A", hasEvaluationTargetDate: null }),
    ];
    expect(sortByUrgency(rows, NOW).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("jours avant l'évaluation", () => {
    expect(daysUntilEvaluation(facts({ hasEvaluationTargetDate: null }), NOW)).toBeNull();
    expect(daysUntilEvaluation(facts({ hasEvaluationTargetDate: inDays(12) }), NOW)).toBe(12);
  });
});

describe("selectWatchList", () => {
  it("ne garde que les structures avec un motif, la plus grave d'abord, bornée", () => {
    const rows = [
      facts({ id: "calm" }),
      facts({ id: "msg", hasUnansweredMessage: true }),
      facts({ id: "deadline", hasEvaluationTargetDate: inDays(30) }),
      facts({ id: "review", documentsAwaitingReview: 2 }),
      facts({ id: "review-and-msg", documentsAwaitingReview: 1, hasUnansweredMessage: true }),
    ];
    expect(selectWatchList(rows, NOW).map((w) => w.row.id)).toEqual(["deadline", "review-and-msg", "review", "msg"]);
    expect(selectWatchList(rows, NOW, 2)).toHaveLength(2);
  });

  it("à gravité égale, l'échéance la plus proche d'abord", () => {
    const rows = [
      facts({ id: "later", hasEvaluationTargetDate: inDays(80) }),
      facts({ id: "sooner", hasEvaluationTargetDate: inDays(15) }),
    ];
    expect(selectWatchList(rows, NOW).map((w) => w.row.id)).toEqual(["sooner", "later"]);
  });
});

describe("libellés", () => {
  it("dernière activité", () => {
    expect(describeLastActivity(null, NOW)).toBe("Aucune activité enregistrée");
    expect(describeLastActivity(inDays(0), NOW)).toBe("Aujourd'hui");
    expect(describeLastActivity(inDays(-3), NOW)).toBe("Il y a 3 jours");
  });

  it("couverture loi 2002-2", () => {
    expect(describeLoi2002Coverage(facts())).toBe("4 / 7");
  });

  it("phrase de synthèse de l'accueil", () => {
    expect(buildGreetingSummary({ awaitingReview: 0, watchCount: 0 })).toBe(
      "Tout est relu. Aucune structure ne demande d'attention particulière."
    );
    expect(buildGreetingSummary({ awaitingReview: 1, watchCount: 1 })).toBe(
      "1 document attend votre relecture. 1 structure est à surveiller."
    );
    expect(buildGreetingSummary({ awaitingReview: 5, watchCount: 3 })).toBe(
      "5 documents attendent votre relecture. 3 structures sont à surveiller."
    );
  });

  it("prénom pour « Bonjour »", () => {
    expect(firstNameOf("Marie Dupont")).toBe("Marie");
    expect(firstNameOf("  ")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
});
