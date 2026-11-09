import type { DocumentStatus } from "@eoda/database";
import type { PhaseState, TimelinePhase } from "@/components/ui/phase-timeline";
import { DOCUMENT_PILLS, type PillSpec } from "@/lib/design/status-vocabulary";
import { structureHref } from "@/lib/design/structure-tabs";
import { actionPill, describeOwner, sortActionItems, type ActionItemFacts } from "./action-item-service";
import { selectUpcoming, type CalendarAppointment } from "./calendar-service";
import { chapterLabel } from "./chapter-label-service";
import { formatDate, formatDateTime } from "./date-format-service";
import { documentTypeLabelKey } from "./document-type-creation-service";
import { formatDaysUntil } from "./elapsed-time-service";
import {
  MISSION_STEPS,
  PHASE_DATE_FIELDS,
  stepPercent,
  type MissionPhase,
  type MissionPhaseDates,
  type MissionProgress,
  type MissionStep,
  type MissionStepId,
} from "./mission-progress-service";
import { isReminderCandidate } from "./reminder-service";
import { reviewItemHref } from "./review-queue-service";
import { scoreLabel } from "./scoring-service";
import { documentsHref } from "./structure-documents-service";

// ─────────────────────────────────────────────────────────────────────────────
// FICHE STRUCTURE (cabinet) — en-tête et vue d'ensemble, règles pures.
//
// Tout est DÉRIVÉ de faits déjà lus ailleurs (file « À relire », checklist, mission,
// agenda). « Les prochaines actions » ne listent que ce qui se dérive aujourd'hui :
// documents à relire, pièces réclamées manquantes, prochain rendez-vous. Pas de
// tâches saisies : elles arrivent avec le plan d'action (tranche N5).
//
// `now` est toujours un paramètre (D7).
// ─────────────────────────────────────────────────────────────────────────────

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export type ReviewSummary = { count: number; oldestVersionId: string | null };

export type PrimaryAction = { label: string; href: string };

// Action principale de l'en-tête, contextuelle : la plus ancienne analyse qui
// attend la relecture humaine s'ouvre dans la file « À relire ». Sinon, rien —
// un bouton principal sans travail derrière serait un faux appel à l'action.
export function derivePrimaryAction(review: ReviewSummary): PrimaryAction | null {
  if (review.count <= 0 || !review.oldestVersionId) return null;
  return {
    label: `Relire ${plural(review.count, "document", "documents")}`,
    href: reviewItemHref(review.oldestVersionId),
  };
}

// « Évaluation HAS dans 86 jours · 02/01/2027 ». Null sans date : on tait ce qu'on
// ne sait pas plutôt que d'écrire « — ».
export function describeEvaluationCountdown(target: Date | null, now: Date): string | null {
  if (!target) return null;
  return `Évaluation HAS ${formatDaysUntil(target, now)} · ${formatDate(target)}`;
}

// ── Cadres « Où en est la structure » ─────────────────────────────────────────

export type Measure = { label: string; value: string; percent?: number; note: string };

// Chapitre : la moyenne des cotations EXISTANTES (scoring-service, ★ = 4), lue par
// getEvaluationChapter. Rien de coté = « Non coté », sans jauge — un zéro mentirait.
// Cadre « Critères impératifs » (N4) : x / 16 (SAD aide) ou x / 17 (SAD mixte) — le
// total vient des critères en base, le repère du profil n'est cité que s'il diffère.
export function describeImperativesMeasure(
  proof: { proven: number; total: number },
  expected: number,
  // Impératifs « en partie » (countImperativesInProgress) : dit que le travail avance
  // même quand aucun n'est encore entièrement prouvé.
  inProgress = 0
): Measure {
  const base =
    proof.total === expected ? "prouvés par des documents relus ou acceptés" : `prouvés — repère du profil : ${expected}`;
  return {
    label: "Critères impératifs",
    value: `${proof.proven} / ${proof.total}`,
    percent: proof.total === 0 ? 0 : Math.round((proof.proven / proof.total) * 100),
    note: inProgress > 0 ? `${base} · ${inProgress} en partie (une pièce attendue reste à relire ou à déposer)` : base,
  };
}

export function describeChapterMeasure(chapter: {
  number: number;
  name: string;
  score: number | null;
  imperatifsAtRisk: number;
}): Measure {
  const label = chapterLabel(chapter);
  if (chapter.score === null) return { label, value: "Non coté", note: "Aucune cotation enregistrée" };
  const atRisk =
    chapter.imperatifsAtRisk > 0
      ? ` · ${plural(chapter.imperatifsAtRisk, "impératif coté sous 4", "impératifs cotés sous 4")}`
      : "";
  return {
    label,
    value: `${chapter.score.toFixed(1).replace(".", ",")} / 4`,
    percent: Math.round((chapter.score / 4) * 100),
    note: `${scoreLabel(chapter.score)}${atRisk}`,
  };
}

// Documents loi 2002-2 : types DÉPOSÉS sur types attendus — pas des documents
// conformes, et la note le dit.
// Un document déclaré « Non concerné » (le CVS d'une structure qui n'en a pas, seule
// exception de la loi 2002-2 — missing-answer-service) sort du total : la structure
// n'a pas à le produire.
export function describeLoi2002Measure(
  allItems: readonly { currentVersion: unknown; step: string; status?: string }[]
): Measure {
  const items = allItems.filter((i) => i.status !== "NOT_APPLICABLE");
  const deposited = items.filter((i) => i.currentVersion !== null).length;
  const validated = items.filter((i) => i.step === "VALIDE").length;
  return {
    label: "Documents loi 2002-2",
    value: `${deposited} / ${items.length}`,
    percent: items.length === 0 ? 0 : Math.round((deposited / items.length) * 100),
    note: `Déposés · ${plural(validated, "validé", "validés")} par EODA`,
  };
}

// ── Frise de mission ─────────────────────────────────────────────────────────

export type TimelineMission = MissionPhaseDates & {
  progress: Pick<MissionProgress, "phasePcts" | "stepPcts">;
};

function period(start: Date | null, end: Date | null): string | undefined {
  if (!start && !end) return undefined;
  return `${start ? formatDate(start) : "…"} → ${end ? formatDate(end) : "…"}`;
}

function periodOf(text: string | undefined): { period?: string } {
  return text === undefined ? {} : { period: text };
}

// État d'une phase stockée, dérivé de ses dates et de son avancement : terminée si
// tout est coché ou si sa date de fin est passée ; en cours si elle a commencé (date
// ou premier item coché) ; à venir sinon.
function phaseState(mission: TimelineMission, phase: MissionPhase, now: Date): PhaseState {
  const start = mission[PHASE_DATE_FIELDS[phase].start];
  const end = mission[PHASE_DATE_FIELDS[phase].end];
  const percent = mission.progress.phasePcts[phase];
  if (percent === 100 || (end !== null && end < now)) return "done";
  if ((start !== null && start <= now) || (percent ?? 0) > 0) return "current";
  return "upcoming";
}

// État d'une étape : celui de ses phases APPLICABLES (une phase hors formule n'a
// pas d'avancement et ne retient pas l'étape). Terminée si toutes le sont, en cours
// dès que l'une a commencé. Le diagnostic n'a pas de dates : son avancement seul.
//
// La MISE EN CONFORMITÉ ne se termine qu'à 100 % des documents prouvés (call du
// 09/11/2026) : ni ses jalons cochés ni une date de fin passée ne la ferment — elle
// affichait « Terminée » sur une structure dont les documents restaient à valider.
function stepState(mission: TimelineMission, step: MissionStep, now: Date): PhaseState {
  const percent = stepPercent(step, mission.progress) ?? 0;
  if (step.phases.length === 0) {
    return percent === 100 ? "done" : percent > 0 ? "current" : "upcoming";
  }
  if (step.id === "MISE_EN_CONFORMITE") {
    if (percent === 100) return "done";
    const started =
      percent > 0 ||
      step.phases.some((phase) => {
        const start = mission[PHASE_DATE_FIELDS[phase].start];
        return (start !== null && start <= now) || (mission.progress.phasePcts[phase] ?? 0) > 0;
      });
    return started ? "current" : "upcoming";
  }
  const states = step.phases
    .filter((phase) => mission.progress.phasePcts[phase] !== undefined)
    .map((phase) => phaseState(mission, phase, now));
  if (states.length === 0) return "upcoming";
  if (states.every((s) => s === "done")) return "done";
  return states.some((s) => s !== "upcoming") ? "current" : "upcoming";
}

// Période d'une étape : début de sa première phase, fin de sa dernière.
function stepPeriod(mission: TimelineMission, step: MissionStep): string | undefined {
  const first = step.phases[0];
  const last = step.phases[step.phases.length - 1];
  if (!first || !last) return undefined;
  return period(mission[PHASE_DATE_FIELDS[first].start], mission[PHASE_DATE_FIELDS[last].end]);
}

// Frise en QUATRE ÉTAPES (MISSION_STEPS) : la checklist de diagnostic, puis les
// phases datées regroupées. Une étape hors formule n'a pas d'avancement.
// Avec `establishmentId`, chaque étape est un lien (son premier écran de travail,
// call du 09/11/2026) et porte ses autres liens (missionStepLinks).
export function toTimelinePhases(
  mission: TimelineMission,
  now: Date,
  establishmentId?: string,
  extras: StepLinkExtras = {}
): TimelinePhase[] {
  return MISSION_STEPS.map((step) => {
    const percent = stepPercent(step, mission.progress);
    const links = establishmentId === undefined ? undefined : missionStepLinks(establishmentId, step.id, extras);
    return {
      id: step.id,
      label: step.label,
      state: stepState(mission, step, now),
      ...(links?.[0] !== undefined && { links, href: links[0].href }),
      ...(percent !== undefined && { percent }),
      ...periodOf(percent === undefined ? "Hors formule" : stepPeriod(mission, step)),
    };
  });
}

// Où se travaille chaque étape (retour de Sandrine, 08/11/2026 : « si je clique
// "Diagnostic" je devrais tomber sur l'auto-évaluation et le rapport »). La checklist
// de l'étape, dans l'onglet Mission, ferme toujours la liste.
// Le PREMIER lien est la destination de l'étape elle-même (son titre dans la frise).
export type StepLink = { label: string; href: string };

// Liens qui dépendent de faits lus ailleurs. `depositedReportHref` : le rapport de
// diagnostic Word déposé dans les documents de la structure, s'il existe
// (depositedDiagnosticReportHref).
export type StepLinkExtras = { depositedReportHref?: string | null };

export function missionStepLinks(establishmentId: string, step: MissionStepId, extras: StepLinkExtras = {}): StepLink[] {
  const checklist = { label: "Checklist de l'étape", href: `${structureHref(establishmentId, "mission")}#etape-${step}` };
  const evaluation = { label: "Auto-évaluation", href: structureHref(establishmentId, "evaluation") };
  switch (step) {
    case "DIAGNOSTIC":
      return [
        evaluation,
        { label: "Rapport de diagnostic", href: `/imprimer/diagnostic/${encodeURIComponent(establishmentId)}` },
        ...(extras.depositedReportHref ? [{ label: "Rapport déposé (Word)", href: extras.depositedReportHref }] : []),
        checklist,
      ];
    case "MISE_EN_CONFORMITE":
      return [
        { label: "Documents", href: structureHref(establishmentId, "documents") },
        { label: "Critères", href: structureHref(establishmentId, "criteres") },
        checklist,
      ];
    case "SUIVI":
      return [{ label: "Plan d'action", href: structureHref(establishmentId, "plan-action") }, checklist];
    case "PREPARATION_FINALE":
      return [checklist, evaluation];
  }
}

// Le rapport de diagnostic Word que le cabinet dépose dans « Documents » (dossier
// Pilotage qualité, call du 09/11/2026). C'est une ligne créée par le cabinet
// (DocumentType global, code EODA_… généré) : aucun code ne la désigne, on la
// reconnaît à son INTITULÉ, comparé sans accents ni casse (documentTypeLabelKey,
// la clé des doublons). Ce n'est qu'un raccourci de navigation : sans dépôt, aucun
// lien — on ne renvoie jamais vers un document qui n'existe pas.
const DIAGNOSTIC_REPORT_KEY = documentTypeLabelKey("Rapport de diagnostic");

export function depositedDiagnosticReportHref(
  establishmentId: string,
  rows: readonly { documentTypeId: string; label: string; currentVersion: unknown }[]
): string | null {
  const report = rows.find(
    (row) => row.currentVersion !== null && documentTypeLabelKey(row.label).includes(DIAGNOSTIC_REPORT_KEY)
  );
  return report ? documentsHref(structureHref(establishmentId, "documents"), { doc: report.documentTypeId }) : null;
}

// ── Les prochaines actions ───────────────────────────────────────────────────

export type NextActionDocument = {
  documentTypeId: string;
  label: string;
  status: DocumentStatus;
  requestedFromClient: boolean;
  missingJustification: string | null;
  currentVersion: { id: string; uploadedAt: Date; analysisAwaitingReview: boolean } | null;
};

export type NextAction = {
  id: string;
  label: string;
  detail: string;
  pill: PillSpec | null;
  href: string | null;
};

export const NEXT_ACTIONS_LIMIT = 5;

export function deriveNextActions(input: {
  establishmentId: string;
  documents: readonly NextActionDocument[];
  appointments: CalendarAppointment[];
  now: Date;
  // Tâches du plan d'action (N5) : les ouvertes, en retard d'abord.
  tasks?: readonly (ActionItemFacts & { ownerName: string | null })[];
  limit?: number;
}): NextAction[] {
  const documentsPath = structureHref(input.establishmentId, "documents");

  const toReview = input.documents
    .flatMap((d) => (d.currentVersion?.analysisAwaitingReview ? [{ doc: d, version: d.currentVersion }] : []))
    .sort((a, b) => a.version.uploadedAt.getTime() - b.version.uploadedAt.getTime())
    .map(
      ({ doc, version }): NextAction => ({
        id: `review-${doc.documentTypeId}`,
        label: `Relire « ${doc.label} »`,
        detail: `Déposé le ${formatDate(version.uploadedAt)}`,
        pill: DOCUMENT_PILLS.aRelire,
        href: reviewItemHref(version.id),
      })
    );

  const appointment = selectUpcoming(input.appointments, input.now, 1).map(
    (a): NextAction => ({
      id: `rdv-${a.id}`,
      label: `Rendez-vous : ${a.subject}`,
      detail: formatDateTime(a.startsAt),
      pill: null,
      href: null,
    })
  );

  const toObtain = input.documents.filter(isReminderCandidate).map(
    (d): NextAction => ({
      id: `missing-${d.documentTypeId}`,
      label: `Obtenir « ${d.label} »`,
      detail: "Réclamé à la structure",
      pill: DOCUMENT_PILLS.manquant,
      href: documentsHref(documentsPath, { doc: d.documentTypeId }),
    })
  );

  const tasks = sortActionItems(
    (input.tasks ?? []).filter((t) => t.doneAt === null),
    input.now
  ).map(
    (t): NextAction => ({
      id: `task-${t.id}`,
      label: t.title,
      detail: t.dueOn ? `${describeOwner(t)} · échéance ${formatDate(t.dueOn)}` : describeOwner(t),
      pill: actionPill(t, input.now),
      href: structureHref(input.establishmentId, "plan-action"),
    })
  );

  return [...toReview, ...tasks, ...appointment, ...toObtain].slice(0, input.limit ?? NEXT_ACTIONS_LIMIT);
}
