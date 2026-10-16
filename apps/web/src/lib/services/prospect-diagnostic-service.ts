import type { PracticeAnswerValue } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC DÉCLARATIF D'UNE STRUCTURE INSCRITE SEULE — règles pures (D5, 13/10).
//
// Tout est DÉRIVÉ des réponses (append-only) et des rendez-vous : avancement, liste de
// travail estimée, « signal » d'activité vu par le cabinet. Rien n'est stocké.
// Le cabinet voit l'avancement et l'activité, JAMAIS le contenu des réponses.
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticStage = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export type DiagnosticProgress = { answered: number; total: number; percent: number; stage: DiagnosticStage; label: string };

export function deriveDiagnosticProgress(answered: number, total: number): DiagnosticProgress {
  const safeTotal = Math.max(total, 0);
  const done = Math.min(Math.max(answered, 0), safeTotal);
  const percent = safeTotal === 0 ? 0 : Math.round((done / safeTotal) * 100);
  if (done === 0) return { answered: done, total: safeTotal, percent: 0, stage: "NOT_STARTED", label: "Pas commencé" };
  if (done >= safeTotal) return { answered: done, total: safeTotal, percent: 100, stage: "DONE", label: "Terminé" };
  return { answered: done, total: safeTotal, percent, stage: "IN_PROGRESS", label: `En cours · ${percent} %` };
}

// ── Liste de travail estimée ─────────────────────────────────────────────────
// Un critère auquel la structure n'a pas répondu « Oui » appelle les documents que la
// matrice rattache à ce critère. Liste dédupliquée, triée : un même document peut
// prouver plusieurs critères. C'est une ESTIMATION, dite comme telle à l'écran.
export type WorkCriterion = {
  criterionId: string;
  criterionCode: string;
  answer: PracticeAnswerValue | null;
  expectedDocuments: readonly { id: string; label: string }[];
};

export type WorkItem = { documentTypeId: string; label: string; criterionCodes: string[] };

export function buildWorkList(criteria: readonly WorkCriterion[]): WorkItem[] {
  const byDocument = new Map<string, WorkItem>();
  for (const criterion of criteria) {
    if (criterion.answer === "OUI" || criterion.answer === null) continue;
    for (const doc of criterion.expectedDocuments) {
      const item = byDocument.get(doc.id) ?? { documentTypeId: doc.id, label: doc.label, criterionCodes: [] };
      if (!item.criterionCodes.includes(criterion.criterionCode)) item.criterionCodes.push(criterion.criterionCode);
      byDocument.set(doc.id, item);
    }
  }
  return [...byDocument.values()].sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

// ── Signal d'activité (cabinet) ──────────────────────────────────────────────
export const INACTIVITY_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ProspectKind = "CALL" | "DONE" | "IN_PROGRESS";
export type SignalTone = "accent" | "amber" | "green" | "red";
export type ProspectSignal = { kind: ProspectKind; text: string; tone: SignalTone; inactive: boolean };

export type SignalFacts = {
  now: Date;
  signedUpAt: Date;
  lastActivityAt: Date | null;
  // Rendez-vous « Être accompagné » encore ouvert (demandé, proposé ou confirmé, à venir).
  pendingCall: { day: Date; momentLabel: string } | null;
  progress: DiagnosticProgress;
};

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export function deriveProspectSignal(facts: SignalFacts): ProspectSignal {
  if (facts.pendingCall) {
    return {
      kind: "CALL",
      text: `Appel demandé · ${formatDay(facts.pendingCall.day)}, ${facts.pendingCall.momentLabel}`,
      tone: "accent",
      inactive: false,
    };
  }
  const kind: ProspectKind = facts.progress.stage === "DONE" ? "DONE" : "IN_PROGRESS";
  const last = facts.lastActivityAt ?? facts.signedUpAt;
  const idle = daysBetween(last, facts.now);
  if (facts.lastActivityAt === null) {
    const since = daysBetween(facts.signedUpAt, facts.now);
    if (since >= INACTIVITY_DAYS) return { kind, text: `Aucune activité depuis ${since} jours`, tone: "red", inactive: true };
    return { kind, text: since <= 0 ? "Inscrite aujourd'hui" : `Inscrite il y a ${since} jour${since > 1 ? "s" : ""}`, tone: "amber", inactive: false };
  }
  if (idle >= INACTIVITY_DAYS) return { kind, text: `Aucune activité depuis ${idle} jours`, tone: "red", inactive: kind !== "DONE" };
  if (idle <= 0) return { kind, text: "Active aujourd'hui", tone: "green", inactive: false };
  if (idle === 1) return { kind, text: "Active hier", tone: "green", inactive: false };
  return { kind, text: `Active il y a ${idle} jours`, tone: "amber", inactive: false };
}

// ── Demande « Être accompagné » ──────────────────────────────────────────────
// Préférence LIBRE de la structure : un jour et un moment. Aucun agenda de
// disponibilités n'existe ; EODA confirme ensuite.
export const CALL_MOMENTS = {
  MATIN: { label: "le matin", title: "Le matin", hour: 9 },
  APRES_MIDI: { label: "l'après-midi", title: "L'après-midi", hour: 14 },
} as const;
export type CallMoment = keyof typeof CALL_MOMENTS;
export const CALL_DURATION_MINUTES = 20;
export const CALL_MAX_DAYS_AHEAD = 60;
export const CALL_MESSAGE_MAX = 500;

export type CallRequest = { startsAt: Date; endsAt: Date; moment: CallMoment; message: string | null };
export type CallRequestCheck = { ok: true; value: CallRequest } | { ok: false; error: string };

export function validateCallRequest(raw: { day: unknown; moment: unknown; message: unknown }, now: Date): CallRequestCheck {
  const dayText = typeof raw.day === "string" ? raw.day.trim() : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayText);
  if (!match) return { ok: false, error: "Choisissez un jour." };
  const moment = typeof raw.moment === "string" && raw.moment in CALL_MOMENTS ? (raw.moment as CallMoment) : null;
  if (!moment) return { ok: false, error: "Choisissez le matin ou l'après-midi." };
  const startsAt = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), CALL_MOMENTS[moment].hour, 0, 0, 0);
  if (Number.isNaN(startsAt.getTime()) || startsAt.getDate() !== Number(match[3])) return { ok: false, error: "Ce jour n'existe pas." };
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const latest = new Date(now.getFullYear(), now.getMonth(), now.getDate() + CALL_MAX_DAYS_AHEAD + 1);
  if (startsAt < tomorrow || startsAt >= latest) {
    return { ok: false, error: `Choisissez un jour entre demain et dans ${CALL_MAX_DAYS_AHEAD} jours.` };
  }
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (message.length > CALL_MESSAGE_MAX) return { ok: false, error: `Votre message est trop long (${CALL_MESSAGE_MAX} caractères au plus).` };
  return {
    ok: true,
    value: { startsAt, endsAt: new Date(startsAt.getTime() + CALL_DURATION_MINUTES * 60 * 1000), moment, message: message || null },
  };
}

export function momentLabelFor(startsAt: Date): string {
  return startsAt.getHours() < 12 ? CALL_MOMENTS.MATIN.label : CALL_MOMENTS.APRES_MIDI.label;
}
