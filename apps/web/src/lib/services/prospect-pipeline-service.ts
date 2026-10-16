import type { AcquisitionChannel, CommercialTier } from "@eoda/database";
import type { DiagnosticProgress, ProspectSignal } from "./prospect-diagnostic-service";

// ─────────────────────────────────────────────────────────────────────────────
// TABLEAU « PROSPECTS » (maquette v2) — règles pures, 13/10/2026.
//
// Un seul tableau pour les deux origines : les structures inscrites SEULES
// (libre-service, diagnostic en ligne) et les prospects DÉMARCHÉS (bouche-à-oreille,
// UNA…), que la maquette ne montrait pas. Filtre « Origine » + onglets de la
// maquette. Tout est dérivé ; rien n'est stocké. Le kanban est retiré (Damon, 13/10).
// ─────────────────────────────────────────────────────────────────────────────

export type ProspectOrigin = "LIBRE_SERVICE" | "DEMARCHE";
export type OriginFilter = "TOUS" | ProspectOrigin;
export type PipelineTab = "tous" | "appel" | "termine" | "en-cours";

export const PIPELINE_TABS: readonly { id: PipelineTab; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "appel", label: "Appel demandé" },
  { id: "termine", label: "Diagnostic terminé" },
  { id: "en-cours", label: "Diagnostic en cours" },
];

export const ORIGIN_FILTERS: readonly { id: OriginFilter; label: string }[] = [
  { id: "TOUS", label: "Toutes origines" },
  { id: "LIBRE_SERVICE", label: "Libre-service" },
  { id: "DEMARCHE", label: "Démarché" },
];

export function parsePipelineTab(value: string | undefined): PipelineTab {
  return PIPELINE_TABS.find((t) => t.id === value)?.id ?? "tous";
}

export function parseOriginFilter(value: string | undefined): OriginFilter {
  return ORIGIN_FILTERS.find((o) => o.id === value)?.id ?? "TOUS";
}

export function originOf(channel: AcquisitionChannel): ProspectOrigin {
  return channel === "LIBRE_SERVICE" ? "LIBRE_SERVICE" : "DEMARCHE";
}

export type PipelineRow = {
  id: string;
  origin: ProspectOrigin;
  // Libre-service : diagnostic et signal ; démarché : null.
  progress: DiagnosticProgress | null;
  signal: ProspectSignal | null;
  hasPendingCall: boolean;
};

export function tabsOf(row: PipelineRow): PipelineTab[] {
  const tabs: PipelineTab[] = ["tous"];
  if (row.hasPendingCall) tabs.push("appel");
  if (row.progress?.stage === "DONE") tabs.push("termine");
  else if (row.progress) tabs.push("en-cours");
  return tabs;
}

function matchesOrigin(row: PipelineRow, origin: OriginFilter): boolean {
  return origin === "TOUS" || row.origin === origin;
}

export function filterPipeline<T extends PipelineRow>(rows: readonly T[], tab: PipelineTab, origin: OriginFilter): T[] {
  return rows.filter((r) => matchesOrigin(r, origin) && tabsOf(r).includes(tab));
}

export function countPipelineTabs(rows: readonly PipelineRow[], origin: OriginFilter): Record<PipelineTab, number> {
  const counts: Record<PipelineTab, number> = { tous: 0, appel: 0, termine: 0, "en-cours": 0 };
  for (const row of rows) {
    if (!matchesOrigin(row, origin)) continue;
    for (const tab of tabsOf(row)) counts[tab] += 1;
  }
  return counts;
}

// Geste de la ligne (maquette) : Préparer l'appel, Appeler, Relancer — et « Ouvrir »
// pour un prospect démarché, dont le suivi vit sur la fiche.
export type PipelineAction = "PREPARE_CALL" | "CALL" | "REMIND" | "OPEN";

export function pipelineAction(row: PipelineRow): PipelineAction {
  if (row.hasPendingCall) return "PREPARE_CALL";
  if (row.origin === "DEMARCHE") return "OPEN";
  if (row.progress?.stage === "DONE") return "CALL";
  return "REMIND";
}

export const PIPELINE_ACTION_LABELS: Record<PipelineAction, string> = {
  PREPARE_CALL: "Préparer l'appel",
  CALL: "Appeler",
  REMIND: "Relancer",
  OPEN: "Ouvrir",
};

// Étiquette de mode : « Essentiel · seul », « Excellence · avec EODA » pour une
// structure inscrite ; « Démarché » pour les autres (le canal est dit sur la fiche).
export function modeLabelFor(origin: ProspectOrigin, formule: CommercialTier | null): string {
  if (origin === "DEMARCHE") return "Démarché";
  if (formule === "EXCELLENCE") return "Excellence · avec EODA";
  if (formule === "PERFORMANCE") return "Performance · seul";
  if (formule === "ESSENTIEL") return "Essentiel · seul";
  return "Inscrite seule";
}
