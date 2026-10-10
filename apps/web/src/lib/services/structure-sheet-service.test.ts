import { describe, expect, it } from "vitest";
import { DOCUMENT_PILLS } from "@/lib/design/status-vocabulary";
import type { CalendarAppointment } from "./calendar-service";
import {
  deriveNextActions,
  describeChapterMeasure,
  describeLoi2002Measure,
  derivePrimaryAction,
  describeEvaluationCountdown,
  toTimelinePhases,
  type NextActionDocument,
  type TimelineMission,
} from "./structure-sheet-service";

const NOW = new Date(2026, 9, 9, 9, 0);
const day = (offset: number) => new Date(2026, 9, 9 + offset, 12, 0);

describe("derivePrimaryAction — action principale contextuelle", () => {
  it("documents à relire : ouvre le plus ancien dans la file", () => {
    expect(derivePrimaryAction({ count: 3, oldestVersionId: "v-old" })).toEqual({
      label: "Relire 3 documents",
      href: "/dashboard/cabinet/a-relire?v=v-old",
    });
    expect(derivePrimaryAction({ count: 1, oldestVersionId: "v1" })?.label).toBe("Relire 1 document");
  });

  it("rien à relire : aucune action principale", () => {
    expect(derivePrimaryAction({ count: 0, oldestVersionId: null })).toBeNull();
    expect(derivePrimaryAction({ count: 2, oldestVersionId: null })).toBeNull();
  });
});

describe("describeEvaluationCountdown", () => {
  it("dit le nombre de jours et la date", () => {
    expect(describeEvaluationCountdown(new Date(2027, 0, 3), NOW)).toBe("Évaluation HAS dans 86 jours · 03/01/2027");
  });

  it("échéance dépassée, ou absente", () => {
    expect(describeEvaluationCountdown(day(-2), NOW)).toMatch(/^Évaluation HAS dépassée depuis 2 jours/);
    expect(describeEvaluationCountdown(null, NOW)).toBeNull();
  });
});

describe("toTimelinePhases — frise aux libellés de la décision 3", () => {
  const mission: TimelineMission = {
    fondationsStartDate: day(-60),
    fondationsEndDate: day(-30),
    deploiementStartDate: day(-29),
    deploiementEndDate: day(30),
    consolidationStartDate: null,
    consolidationEndDate: null,
    preparationFinaleStartDate: null,
    preparationFinaleEndDate: null,
    progress: { phasePcts: { FONDATIONS: 100, DEPLOIEMENT: 40, CONSOLIDATION: 0 } },
  };

  it("dérive l'état de chaque phase et garde les libellés", () => {
    const phases = toTimelinePhases(mission, NOW);
    expect(phases.map((p) => [p.label, p.state])).toEqual([
      ["Phase 1 — Diagnostic", "done"],
      ["Phase 2 — Mise en conformité", "current"],
      ["Phase 3 — Suivi", "upcoming"],
      ["Phase 4 — Préparation finale", "upcoming"],
    ]);
    expect(phases[1]).toMatchObject({ percent: 40, period: "10/09/2026 → 08/11/2026" });
  });

  it("une phase hors formule n'a pas d'avancement", () => {
    expect(toTimelinePhases(mission, NOW)[3]).toMatchObject({ period: "Hors formule" });
    expect(toTimelinePhases(mission, NOW)[3]).not.toHaveProperty("percent");
  });

  it("une date de fin passée termine la phase ; un item coché la démarre", () => {
    const phases = toTimelinePhases(
      {
        ...mission,
        fondationsEndDate: day(-1),
        progress: { phasePcts: { FONDATIONS: 50, DEPLOIEMENT: 0, CONSOLIDATION: 10 } },
        deploiementStartDate: day(5),
        consolidationEndDate: day(40),
      },
      NOW
    );
    expect(phases.map((p) => p.state).slice(0, 3)).toEqual(["done", "upcoming", "current"]);
    expect(phases[2]?.period).toBe("… → 18/11/2026");
  });
});

describe("deriveNextActions — seulement ce qui se dérive", () => {
  const document = (over: Partial<NextActionDocument>): NextActionDocument => ({
    documentTypeId: "t",
    label: "Document",
    status: "UPLOADED",
    requestedFromClient: true,
    missingJustification: null,
    currentVersion: null,
    ...over,
  });
  const appointment = (over: Partial<CalendarAppointment>): CalendarAppointment =>
    ({
      id: "a1",
      kind: "SUIVI",
      mode: "VISIO",
      status: "CONFIRME",
      startsAt: day(2),
      endsAt: day(2),
      subject: "Point d'étape",
      location: null,
      structureName: "SAD Les Glycines (fictif)",
      href: null,
      ...over,
    }) as CalendarAppointment;

  const documents = [
    document({ documentTypeId: "recent", label: "Livret", currentVersion: { id: "v2", uploadedAt: day(-1), analysisAwaitingReview: true } }),
    document({ documentTypeId: "old", label: "Règlement", currentVersion: { id: "v1", uploadedAt: day(-6), analysisAwaitingReview: true } }),
    document({ documentTypeId: "missing", label: "Procédure plaintes", status: "MISSING" }),
    // Justifiée par la structure, ou produite par EODA : jamais réclamée.
    document({ documentTypeId: "justified", status: "MISSING", missingJustification: "Pas concernés" }),
    document({ documentTypeId: "eoda", status: "MISSING", requestedFromClient: false }),
  ];

  it("relectures (la plus ancienne d'abord), prochain rendez-vous, puis pièces à obtenir", () => {
    const actions = deriveNextActions({
      establishmentId: "e1",
      documents,
      appointments: [appointment({ id: "past", startsAt: day(-3), endsAt: day(-3) }), appointment({})],
      now: NOW,
    });
    expect(actions.map((a) => a.id)).toEqual(["review-old", "review-recent", "rdv-a1", "missing-missing"]);
    expect(actions[0]).toMatchObject({ href: "/dashboard/cabinet/a-relire?v=v1", pill: DOCUMENT_PILLS.aRelire });
    expect(actions[3]).toMatchObject({
      href: "/dashboard/cabinet/etablissements/e1/documents?doc=missing",
      pill: DOCUMENT_PILLS.manquant,
    });
  });

  it("borné à cinq, et vide quand rien ne se dérive", () => {
    const many = Array.from({ length: 8 }, (_, i) => document({ documentTypeId: `m${i}`, status: "MISSING" }));
    expect(deriveNextActions({ establishmentId: "e1", documents: many, appointments: [], now: NOW })).toHaveLength(5);
    expect(deriveNextActions({ establishmentId: "e1", documents: [], appointments: [], now: NOW })).toEqual([]);
  });
});

describe("cadres de mesure", () => {
  it("chapitre coté : moyenne sur 4, lecture indicative, impératifs sous 4", () => {
    expect(describeChapterMeasure({ number: 1, name: "La personne", score: 2.75, imperatifsAtRisk: 2 })).toEqual({
      label: "Chapitre 1 — La personne",
      value: "2,8 / 4",
      percent: 69,
      note: "Plutôt satisfaisant · 2 impératifs cotés sous 4",
    });
    expect(describeChapterMeasure({ number: 2, name: "", score: 4, imperatifsAtRisk: 1 }).note).toBe(
      "Tout à fait satisfaisant · 1 impératif coté sous 4"
    );
  });

  it("chapitre non coté : ni jauge ni zéro", () => {
    expect(describeChapterMeasure({ number: 3, name: "La structure", score: null, imperatifsAtRisk: 0 })).toEqual({
      label: "Chapitre 3 — La structure",
      value: "Non coté",
      note: "Aucune cotation enregistrée",
    });
  });

  it("loi 2002-2 : déposés sur attendus, validés à part", () => {
    expect(
      describeLoi2002Measure([
        { currentVersion: {}, step: "VALIDE" },
        { currentVersion: {}, step: "DEPOSE" },
        { currentVersion: null, step: "ATTENDU" },
        { currentVersion: null, step: "ATTENDU" },
      ])
    ).toEqual({ label: "Documents loi 2002-2", value: "2 / 4", percent: 50, note: "Déposés · 1 validé par EODA" });
    expect(describeLoi2002Measure([]).percent).toBe(0);
  });
});
