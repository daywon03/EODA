import type { CommercialTier, DevisStatus, SupportMode } from "@eoda/database";
import { isDevisDueForReminder, DEVIS_REMINDER_AFTER_DAYS } from "./devis-recap-service";
import { formatDate } from "./date-format-service";

// ─────────────────────────────────────────────────────────────────────────────
// VUE D'ENSEMBLE COMMERCIALE (maquette v2 « Commercial ») — règles pures, 13/10/2026.
//
// Entonnoir en cinq cartes, bloc « À faire » et abonnements actifs : tout est DÉRIVÉ
// des faits (prospects, réponses, rendez-vous, devis, missions). Aucun compteur
// stocké (CLAUDE.md §7 — l'état se dérive). Les prospects DÉMARCHÉS n'ont pas de
// diagnostic en ligne : ils entrent dans l'entonnoir à « Devis en cours ».
// ─────────────────────────────────────────────────────────────────────────────

export type FunnelProspect = {
  selfService: boolean;
  diagnosticDone: boolean;
  hasPendingCall: boolean;
};

export type FunnelDevis = {
  status: DevisStatus;
  // Date de signature : création de la mission née du devis (même transaction) ;
  // à défaut, dernière mise à jour du devis.
  signedAt: Date | null;
};

export type FunnelTarget = { kind: "prospects"; tab: "tous" | "appel" | "termine"; origin: "LIBRE_SERVICE" } | { kind: "devis"; tab: "en-cours" | "signes" };
export type FunnelStep = { step: number; label: string; value: number; target: FunnelTarget };

export function buildFunnel(input: { prospects: readonly FunnelProspect[]; devis: readonly FunnelDevis[]; now: Date }): FunnelStep[] {
  const self = input.prospects.filter((p) => p.selfService);
  const year = input.now.getFullYear();
  return [
    { step: 1, label: "Inscrites seules", value: self.length, target: { kind: "prospects", tab: "tous", origin: "LIBRE_SERVICE" } },
    { step: 2, label: "Diagnostic terminé", value: self.filter((p) => p.diagnosticDone).length, target: { kind: "prospects", tab: "termine", origin: "LIBRE_SERVICE" } },
    { step: 3, label: "Appel réservé", value: self.filter((p) => p.hasPendingCall).length, target: { kind: "prospects", tab: "appel", origin: "LIBRE_SERVICE" } },
    {
      step: 4,
      label: "Devis en cours",
      value: input.devis.filter((d) => d.status === "BROUILLON" || d.status === "ENVOYE").length,
      target: { kind: "devis", tab: "en-cours" },
    },
    {
      step: 5,
      label: "Signés dans l'année",
      value: input.devis.filter((d) => d.status === "SIGNE" && d.signedAt !== null && d.signedAt.getFullYear() === year).length,
      target: { kind: "devis", tab: "signes" },
    },
  ];
}

// ── À faire ───────────────────────────────────────────────────────────────────
export type TodoTone = "accent" | "amber" | "red";
export type TodoAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "remind-devis"; devisId: string; number: string; structureName: string; contactEmail: string }
  | { kind: "remind-prospect"; prospectId: string; structureName: string };
export type TodoItem = { key: string; title: string; meta: string; tone: TodoTone; action: TodoAction };

export type TodoFacts = {
  now: Date;
  calls: readonly { prospectId: string; structureName: string; signalText: string }[];
  openDevis: readonly {
    id: string;
    number: string;
    status: DevisStatus;
    structureName: string;
    contactEmail: string | null;
    lastSentAt: Date;
  }[];
  inactive: readonly { prospectId: string; structureName: string; signalText: string }[];
};

const PROSPECTS = "/dashboard/cabinet/commercial/prospects";
const DEVIS = "/dashboard/cabinet/commercial/devis";

export function buildTodo(facts: TodoFacts): TodoItem[] {
  const calls: TodoItem[] = facts.calls.map((c) => ({
    key: `call-${c.prospectId}`,
    title: "Préparer l'appel",
    meta: `${c.structureName} · ${c.signalText}`,
    tone: "accent",
    action: { kind: "link", label: "Ouvrir", href: `${PROSPECTS}/${c.prospectId}` },
  }));
  const reminders: TodoItem[] = facts.openDevis
    .filter((d) => isDevisDueForReminder({ status: d.status, lastSentAt: d.lastSentAt, now: facts.now }))
    .map((d) => ({
      key: `devis-${d.id}`,
      title: `Relancer le devis ${d.number}`,
      meta: `${d.structureName} · dernier envoi le ${formatDate(d.lastSentAt)} (plus de ${DEVIS_REMINDER_AFTER_DAYS} jours)`,
      tone: "amber",
      action: d.contactEmail
        ? { kind: "remind-devis", devisId: d.id, number: d.number, structureName: d.structureName, contactEmail: d.contactEmail }
        : { kind: "link", label: "Ouvrir", href: `${DEVIS}/${d.id}` },
    }));
  const drafts: TodoItem[] = facts.openDevis
    .filter((d) => d.status === "BROUILLON")
    .map((d) => ({
      key: `draft-${d.id}`,
      title: `Finir le brouillon ${d.number}`,
      meta: d.structureName,
      tone: "amber",
      action: { kind: "link", label: "Reprendre", href: `${DEVIS}/${d.id}/modifier` },
    }));
  const inactive: TodoItem[] = facts.inactive.map((p) => ({
    key: `inactive-${p.prospectId}`,
    title: "Relancer une structure inactive",
    meta: `${p.structureName} · ${p.signalText.toLowerCase()}`,
    tone: "red",
    action: { kind: "remind-prospect", prospectId: p.prospectId, structureName: p.structureName },
  }));
  return [...calls, ...reminders, ...drafts, ...inactive];
}

// ── Abonnements actifs ────────────────────────────────────────────────────────
// Missions NON clôturées, par la formule de la MISSION (jamais commercialTier) ;
// « accompagnée » / « seule » d'après Mission.supportMode. Les offres sans mission
// active restent listées à 0 : une ligne absente laisserait croire à un oubli.
export type ActiveMission = { formule: CommercialTier | null; supportMode: SupportMode };
export type SubscriptionRow = { formule: CommercialTier; total: number; accompanied: number; alone: number; percent: number };

export const SUBSCRIPTION_FORMULES = ["ESSENTIEL", "PERFORMANCE", "EXCELLENCE", "BETA"] as const satisfies readonly CommercialTier[];

export function groupSubscriptions(missions: readonly ActiveMission[]): { rows: SubscriptionRow[]; total: number } {
  const rows = SUBSCRIPTION_FORMULES.map((formule) => {
    const own = missions.filter((m) => m.formule === formule);
    const accompanied = own.filter((m) => m.supportMode === "ACCOMPAGNE").length;
    return { formule, total: own.length, accompanied, alone: own.length - accompanied, percent: 0 };
  }).filter((row) => row.formule !== "BETA" || row.total > 0);
  const max = Math.max(1, ...rows.map((r) => r.total));
  const total = missions.filter((m) => m.formule !== null).length;
  return { rows: rows.map((r) => ({ ...r, percent: Math.round((r.total / max) * 100) })), total };
}

export function describeSubscriptionSplit(row: SubscriptionRow): string {
  const s = (n: number) => (n > 1 ? "s" : "");
  return `${row.accompanied} accompagnée${s(row.accompanied)} · ${row.alone} seule${s(row.alone)}`;
}
