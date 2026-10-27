import { DIPC_DELIVERY_MAX_DAYS } from "@/content/enquete/reception";
import type { BeneficiaryDocumentKind, BeneficiaryDocumentSummary, BeneficiaryTimeline } from "@/lib/hds/beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// ÉCHÉANCES DU DOSSIER — service PUR (lot C, alertes D12).
//
// Ce qui revient chaque année (context/10 §6 et 03-documents-obligatoires) : le PAP
// est réévalué au moins une fois par an, le DIPEC est revu chaque année (questions
// sensibles reposées). Le DIPEC se remet au plus tard 15 jours après le début de
// l'accompagnement. Tout est DÉRIVÉ des faits (dates de remise, début) : aucun
// statut stocké. Une alerte d'échéance part automatiquement — ce n'est pas une
// relance (CLAUDE.md §7).
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
export const DEADLINE_WARNING_DAYS = 30;

const ANNUAL_KINDS: readonly BeneficiaryDocumentKind[] = ["DIPC", "PAP"];

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addOneYear(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

// Échéance de renouvellement posée à la remise : un an pour les documents annuels,
// aucune pour une feuille de réception (elle prouve une remise, elle ne se renouvelle pas).
export function renewalDueOn(kind: BeneficiaryDocumentKind, issuedAt: Date): Date | null {
  return ANNUAL_KINDS.includes(kind) ? addOneYear(issuedAt) : null;
}

export type DeadlineAlert = {
  beneficiaryId: string;
  kind: "DIPC_A_REMETTRE" | "RENOUVELLEMENT";
  documentKind: BeneficiaryDocumentKind;
  dueOn: Date;
  overdue: boolean;
};

function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isWithinWarning(dueOn: Date, today: Date): boolean {
  return startOfDay(dueOn) <= startOfDay(addDays(today, DEADLINE_WARNING_DAYS));
}

// Accompagnement en cours ce jour-là (une fin posée aujourd'hui vaut fin).
export function isActiveOn(person: Pick<BeneficiaryTimeline, "endedOn">, today: Date): boolean {
  return !person.endedOn || startOfDay(person.endedOn) > startOfDay(today);
}

export function deriveDeadlineAlerts(
  beneficiaries: readonly BeneficiaryTimeline[],
  documents: readonly BeneficiaryDocumentSummary[],
  today: Date
): DeadlineAlert[] {
  const active = beneficiaries.filter((b) => isActiveOn(b, today));
  const alerts: DeadlineAlert[] = [];
  for (const person of active) {
    const own = documents.filter((doc) => doc.beneficiaryId === person.id);
    const hasDipc = own.some((doc) => doc.kind === "DIPC" || doc.kind === "FEUILLE_RECEPTION");
    if (!hasDipc) {
      const dueOn = addDays(person.startedOn, DIPC_DELIVERY_MAX_DAYS);
      alerts.push({
        beneficiaryId: person.id,
        kind: "DIPC_A_REMETTRE",
        documentKind: "DIPC",
        dueOn,
        overdue: startOfDay(dueOn) < startOfDay(today),
      });
    }
    for (const kind of ANNUAL_KINDS) {
      const latest = own
        .filter((doc) => doc.kind === kind && doc.renewDueOn)
        .sort((a, b) => b.issuedAt.getTime() - a.issuedAt.getTime())[0];
      if (!latest?.renewDueOn || !isWithinWarning(latest.renewDueOn, today)) continue;
      alerts.push({
        beneficiaryId: person.id,
        kind: "RENOUVELLEMENT",
        documentKind: kind,
        dueOn: latest.renewDueOn,
        overdue: startOfDay(latest.renewDueOn) < startOfDay(today),
      });
    }
  }
  return alerts.sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime());
}
