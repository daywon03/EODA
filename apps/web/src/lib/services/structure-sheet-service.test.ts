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
  missionStepLinks,
  depositedDiagnosticReportHref,
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

describe("toTimelinePhases — frise en quatre étapes (correction du 10/10, documents du 09/11/2026)", () => {
  const mission: TimelineMission = {
    fondationsStartDate: day(-60),
    fondationsEndDate: day(-30),
    deploiementStartDate: day(-29),
    deploiementEndDate: day(30),
    consolidationStartDate: null,
    consolidationEndDate: null,
    preparationFinaleStartDate: null,
    preparationFinaleEndDate: null,
    progress: {
      phasePcts: { FONDATIONS: 100, DEPLOIEMENT: 40, CONSOLIDATION: 0 },
      stepPcts: { DIAGNOSTIC: 100, MISE_EN_CONFORMITE: 54, SUIVI: 0 },
    },
  };

  it("étape 1 = la checklist de diagnostic, pas la phase FONDATIONS", () => {
    const phases = toTimelinePhases(mission, NOW);
    expect(phases.map((p) => [p.id, p.label, p.state])).toEqual([
      ["DIAGNOSTIC", "Diagnostic", "done"],
      ["MISE_EN_CONFORMITE", "Mise en conformité", "current"],
      ["SUIVI", "Suivi", "upcoming"],
      ["PREPARATION_FINALE", "Préparation finale", "upcoming"],
    ]);
    expect(phases[0]).toMatchObject({ percent: 100 });
    expect(phases[0]).not.toHaveProperty("period");
  });

  it("mise en conformité : période des fondations au déploiement, avancement = documents prouvés", () => {
    expect(toTimelinePhases(mission, NOW)[1]).toMatchObject({ percent: 54, period: "10/08/2026 → 08/11/2026" });
  });

  // Call du 09/11/2026 : « Mise en conformité à 100 % » alors que les documents
  // restaient à valider. Les jalons cochés et les dates passées ne la terminent plus.
  it("mise en conformité terminée seulement quand 100 % des documents sont prouvés", () => {
    const allTicked = toTimelinePhases(
      {
        ...mission,
        deploiementEndDate: day(-1),
        progress: { phasePcts: { FONDATIONS: 100, DEPLOIEMENT: 100 }, stepPcts: { DIAGNOSTIC: 0, MISE_EN_CONFORMITE: 54 } },
      },
      NOW
    );
    expect(allTicked[1]).toMatchObject({ state: "current", percent: 54 });
    expect(allTicked[0]?.state).toBe("upcoming");

    const proven = toTimelinePhases(
      { ...mission, progress: { phasePcts: { FONDATIONS: 0 }, stepPcts: { DIAGNOSTIC: 40, MISE_EN_CONFORMITE: 100 } } },
      NOW
    );
    expect(proven[1]).toMatchObject({ state: "done", percent: 100 });
  });

  it("mise en conformité à venir tant que rien n'a commencé (ni date, ni case, ni document)", () => {
    const phases = toTimelinePhases(
      {
        ...mission,
        fondationsStartDate: day(5),
        deploiementStartDate: day(5),
        progress: { phasePcts: { FONDATIONS: 0, DEPLOIEMENT: 0 }, stepPcts: { DIAGNOSTIC: 0, MISE_EN_CONFORMITE: 0 } },
      },
      NOW
    );
    expect(phases[1]?.state).toBe("upcoming");
  });

  it("une étape entière hors formule n'a pas d'avancement", () => {
    const partial = toTimelinePhases(
      { ...mission, progress: { phasePcts: { FONDATIONS: 100 }, stepPcts: { DIAGNOSTIC: 40, MISE_EN_CONFORMITE: 10 } } },
      NOW
    );
    expect(partial[0]?.state).toBe("current");
    expect(partial[3]).toMatchObject({ period: "Hors formule", state: "upcoming" });
    expect(partial[3]).not.toHaveProperty("percent");
  });

  it("suivi : une date de fin passée termine la phase ; un item coché la démarre", () => {
    const phases = toTimelinePhases(
      {
        ...mission,
        progress: { phasePcts: { CONSOLIDATION: 10 }, stepPcts: { DIAGNOSTIC: 0, MISE_EN_CONFORMITE: 0, SUIVI: 10 } },
        consolidationEndDate: day(40),
      },
      NOW
    );
    expect(phases[2]).toMatchObject({ state: "current", period: "… → 18/11/2026" });
    const ended = toTimelinePhases({ ...mission, consolidationEndDate: day(-1) }, NOW);
    expect(ended[2]?.state).toBe("done");
  });

  it("chaque étape s'ouvre sur l'écran où elle se travaille (avec l'identifiant de la structure)", () => {
    const phases = toTimelinePhases(mission, NOW, "e1");
    expect(phases.map((p) => p.href)).toEqual([
      "/dashboard/cabinet/etablissements/e1/evaluation",
      "/dashboard/cabinet/etablissements/e1/documents",
      "/dashboard/cabinet/etablissements/e1/plan-action",
      "/dashboard/cabinet/etablissements/e1/mission#etape-PREPARATION_FINALE",
    ]);
    expect(toTimelinePhases(mission, NOW)[0]).not.toHaveProperty("href");
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
    // Le CVS « Non concerné » (structure sans CVS, 21/10/2026) sort du total.
    expect(
      describeLoi2002Measure([
        { currentVersion: {}, step: "VALIDE", status: "VALIDATED" },
        { currentVersion: null, step: "ATTENDU", status: "NOT_APPLICABLE" },
      ]).value
    ).toBe("1 / 1");
  });
});

// Retour de Sandrine (08/11/2026) : « si je clique "Diagnostic" je devrais tomber sur
// l'auto-évaluation et le rapport de diagnostic ». Chaque étape de la frise mène aux
// écrans où elle se travaille ; la checklist de l'étape, toujours en dernier.
describe("missionStepLinks — où se travaille chaque étape", () => {
  it("Diagnostic : auto-évaluation, rapport de diagnostic, checklist", () => {
    expect(missionStepLinks("e1", "DIAGNOSTIC")).toEqual([
      { label: "Auto-évaluation", href: "/dashboard/cabinet/etablissements/e1/evaluation" },
      { label: "Rapport de diagnostic", href: "/imprimer/diagnostic/e1" },
      { label: "Checklist de l'étape", href: "/dashboard/cabinet/etablissements/e1/mission#etape-DIAGNOSTIC" },
    ]);
  });

  it("Mise en conformité : documents et critères", () => {
    expect(missionStepLinks("e1", "MISE_EN_CONFORMITE").map((l) => l.label)).toEqual([
      "Documents",
      "Critères",
      "Checklist de l'étape",
    ]);
  });

  it("Suivi : plan d'action (les tâches) ; Préparation finale : la checklist de la phase d'abord", () => {
    expect(missionStepLinks("e1", "SUIVI")[0]?.label).toBe("Plan d'action");
    expect(missionStepLinks("e1", "PREPARATION_FINALE").map((l) => l.label)).toEqual([
      "Checklist de l'étape",
      "Auto-évaluation",
    ]);
  });

  // Call du 09/11/2026 : « le diagnostic, c'est l'auto-évaluation + le rapport de
  // diagnostic Word déposé ». Le rapport déposé n'est cité que s'il existe.
  it("Diagnostic : le rapport Word déposé s'ajoute s'il existe", () => {
    const links = missionStepLinks("e1", "DIAGNOSTIC", { depositedReportHref: "/docs?doc=t9" });
    expect(links.map((l) => l.label)).toEqual([
      "Auto-évaluation",
      "Rapport de diagnostic",
      "Rapport déposé (Word)",
      "Checklist de l'étape",
    ]);
    expect(links[2]?.href).toBe("/docs?doc=t9");
    expect(missionStepLinks("e1", "SUIVI", { depositedReportHref: "/x" }).map((l) => l.label)).not.toContain(
      "Rapport déposé (Word)"
    );
  });

  it("le rapport déposé : la ligne « Rapport de diagnostic » (accents, casse ignorés) qui porte un dépôt", () => {
    const row = (documentTypeId: string, label: string, deposited: boolean) => ({
      documentTypeId,
      label,
      currentVersion: deposited ? { id: "v" } : null,
    });
    expect(
      depositedDiagnosticReportHref("e1", [
        row("t1", "Livret d'accueil", true),
        row("t2", "RAPPORT DE DIAGNOSTIC", false),
        row("t3", "Rapport de diagnostic — mission 2026", true),
      ])
    ).toBe("/dashboard/cabinet/etablissements/e1/documents?doc=t3");
    expect(depositedDiagnosticReportHref("e1", [row("t2", "Rapport de diagnostic", false)])).toBeNull();
  });

  it("encode l'identifiant dans l'adresse", () => {
    expect(missionStepLinks("a b", "SUIVI").at(-1)?.href).toContain("a%20b");
  });
});
