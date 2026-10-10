import type { DocumentStatus } from "@eoda/database";
import type { TimelinePhase } from "@/components/ui/phase-timeline";
import { DOCUMENT_PILLS, type PillSpec } from "@/lib/design/status-vocabulary";
import { structureHref } from "@/lib/design/structure-tabs";
import { selectUpcoming, type CalendarAppointment } from "./calendar-service";
import { formatDate, formatDateTime } from "./date-format-service";
import { formatDaysUntil } from "./elapsed-time-service";
import {
  PHASE_DATE_FIELDS,
  PHASE_LABELS,
  PHASE_ORDER,
  type MissionPhaseDates,
  type MissionProgress,
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
export function describeChapterMeasure(chapter: {
  number: number;
  name: string;
  score: number | null;
  imperatifsAtRisk: number;
}): Measure {
  const label = `Chapitre ${chapter.number}${chapter.name ? ` — ${chapter.name}` : ""}`;
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
export function describeLoi2002Measure(items: readonly { currentVersion: unknown; step: string }[]): Measure {
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

export type TimelineMission = MissionPhaseDates & { progress: Pick<MissionProgress, "phasePcts"> };

function period(start: Date | null, end: Date | null): string | undefined {
  if (!start && !end) return undefined;
  return `${start ? formatDate(start) : "…"} → ${end ? formatDate(end) : "…"}`;
}

function periodOf(text: string | undefined): { period?: string } {
  return text === undefined ? {} : { period: text };
}

// État d'une phase, dérivé de ses dates et de son avancement : terminée si tout est
// coché ou si sa date de fin est passée ; en cours si elle a commencé (date ou
// premier item coché) ; à venir sinon. Une phase hors formule n'a pas d'avancement.
export function toTimelinePhases(mission: TimelineMission, now: Date): TimelinePhase[] {
  return PHASE_ORDER.map((phase) => {
    const start = mission[PHASE_DATE_FIELDS[phase].start];
    const end = mission[PHASE_DATE_FIELDS[phase].end];
    const percent = mission.progress.phasePcts[phase];
    const isDone = percent === 100 || (end !== null && end < now);
    const isStarted = (start !== null && start <= now) || (percent ?? 0) > 0;
    return {
      id: phase,
      label: PHASE_LABELS[phase],
      state: isDone ? "done" : isStarted ? "current" : "upcoming",
      ...(percent !== undefined && { percent }),
      ...periodOf(percent === undefined ? "Hors formule" : period(start, end)),
    };
  });
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

  return [...toReview, ...appointment, ...toObtain].slice(0, input.limit ?? NEXT_ACTIONS_LIMIT);
}
