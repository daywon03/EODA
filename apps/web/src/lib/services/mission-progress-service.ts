import type { CommercialTier, MissionChecklistScope } from "@eoda/database";
import type { ComplianceDocuments } from "./mission-document-counters-service";
import { coversMinFormule } from "./offer-scope-service";

// Calcul de progression du suivi de mission — pur, sans dépendance Prisma.
// Règles : context/07-outil-pilotage-missions.md §7.3-§7.4 et §12.4, corrigées au
// call du 09/11/2026 (la mise en conformité compte les documents prouvés).
//
// L'applicabilité n'est plus décidée ici : elle est LUE sur le référentiel
// (MissionChecklistItem.minFormule) et arbitrée par offer-scope-service, seule
// couche à connaître le périmètre des offres. Auparavant ce fichier réécrivait la
// règle sous forme d'une liste RESERVED_SCOPES codée en dur, qui ignorait le
// filtrage des 12 items du diagnostic.

const PHASE_SCOPES: MissionChecklistScope[] = [
  "FONDATIONS",
  "DEPLOIEMENT",
  "CONSOLIDATION",
  "PREPARATION_FINALE",
];

// Libellés et ordre d'affichage — source unique, partagée entre la fiche mission
// (cabinet), la frise de la vue d'ensemble et le suivi de progression (client,
// portail « Mon suivi »). Vivaient auparavant recopiés dans la page cabinet (D1).
//
// Décision 3 des maquettes v2, corrigée par Damon le 10/10/2026 : la mission se lit
// en QUATRE ÉTAPES — Diagnostic / Mise en conformité / Suivi / Préparation finale —
// qui ne correspondent PAS une à une aux quatre phases datées stockées. Le premier
// renommage (09/10) appelait FONDATIONS « Diagnostic », en double avec la checklist
// « Diagnostic initial ». Correspondance d'AFFICHAGE, sans changer le schéma ni les
// clés stockées (renommer une valeur d'enum stockée exigerait une migration
// destructive pour un mot) :
//   Étape 1 Diagnostic          = scope DIAGNOSTIC (les 12 items, sans dates)
//   Étape 2 Mise en conformité  = documents attendus PROUVÉS (09/11/2026) ; les
//                                 phases FONDATIONS + DEPLOIEMENT en sont les jalons
//                                 (dates, cases), jamais la mesure
//   Étape 3 Suivi               = CONSOLIDATION
//   Étape 4 Préparation finale  = PREPARATION_FINALE
// Chaque phase stockée reste éditable sous l'étape qui la regroupe, d'où ses
// libellés propres ci-dessous. Les étapes : MISSION_STEPS, en fin de fichier.
export const PHASE_LABELS: Record<Exclude<MissionChecklistScope, "DIAGNOSTIC">, string> = {
  FONDATIONS: "Mise en conformité — fondations",
  DEPLOIEMENT: "Mise en conformité — déploiement",
  CONSOLIDATION: "Suivi",
  PREPARATION_FINALE: "Préparation finale",
};

export const PHASE_ORDER: Exclude<MissionChecklistScope, "DIAGNOSTIC">[] = [
  "FONDATIONS",
  "DEPLOIEMENT",
  "CONSOLIDATION",
  "PREPARATION_FINALE",
];

export type MissionPhase = Exclude<MissionChecklistScope, "DIAGNOSTIC">;

// Colonnes de dates de chaque phase (noms d'origine, cf. correspondance ci-dessus).
// Partagé par l'écran de mission et la frise de la vue d'ensemble (D1).
export const PHASE_DATE_FIELDS = {
  FONDATIONS: { start: "fondationsStartDate", end: "fondationsEndDate" },
  DEPLOIEMENT: { start: "deploiementStartDate", end: "deploiementEndDate" },
  CONSOLIDATION: { start: "consolidationStartDate", end: "consolidationEndDate" },
  PREPARATION_FINALE: { start: "preparationFinaleStartDate", end: "preparationFinaleEndDate" },
} as const satisfies Record<MissionPhase, { start: string; end: string }>;

type PhaseDateField = (typeof PHASE_DATE_FIELDS)[MissionPhase][keyof (typeof PHASE_DATE_FIELDS)[MissionPhase]];
export type MissionPhaseDates = Record<PhaseDateField, Date | null>;

export type MissionItemProgress = {
  scope: MissionChecklistScope;
  minFormule: CommercialTier;
  completed: boolean;
};

// ── Étapes affichées (regroupement des phases stockées) ─────────────────────

export type MissionStepId = "DIAGNOSTIC" | "MISE_EN_CONFORMITE" | "SUIVI" | "PREPARATION_FINALE";

export type MissionStep = {
  id: MissionStepId;
  number: number;
  label: string;
  // Phases datées regroupées sous l'étape ; vide pour le diagnostic (checklist seule).
  phases: readonly MissionPhase[];
};

export const MISSION_STEPS: readonly MissionStep[] = [
  { id: "DIAGNOSTIC", number: 1, label: "Diagnostic", phases: [] },
  { id: "MISE_EN_CONFORMITE", number: 2, label: "Mise en conformité", phases: ["FONDATIONS", "DEPLOIEMENT"] },
  { id: "SUIVI", number: 3, label: "Suivi", phases: ["CONSOLIDATION"] },
  { id: "PREPARATION_FINALE", number: 4, label: "Préparation finale", phases: ["PREPARATION_FINALE"] },
];

export function stepTitle(step: MissionStep): string {
  return `Étape ${step.number} — ${step.label}`;
}

export type MissionProgress = {
  // Cases cochées / cases applicables, par périmètre (absent = périmètre hors formule).
  counts: Partial<Record<MissionChecklistScope, { done: number; total: number }>>;
  diagnosticPct: number;
  // Avancement de chaque phase datée, en cases cochées. Pour la mise en conformité
  // (FONDATIONS, DEPLOIEMENT), ce sont des JALONS : affichés, jamais comptés dans
  // l'étape (call du 09/11/2026).
  phasePcts: Partial<Record<MissionChecklistScope, number>>;
  // Documents attendus par l'offre, et ceux qui sont prouvés (countComplianceDocuments).
  documents: ComplianceDocuments;
  // Avancement de chaque ÉTAPE affichée (absent = étape entièrement hors formule).
  stepPcts: Partial<Record<MissionStepId, number>>;
  globalPct: number;
};

// Un item est cochable si la formule de la mission couvre son offre minimale.
// C'est aussi la garde serveur de toggleChecklistItem() — l'attribut `disabled`
// de l'UI ne prouve rien, l'action est une route HTTP publique.
export function isChecklistItemApplicable(
  minFormule: CommercialTier,
  formule: CommercialTier | null,
  gratuit: boolean
): boolean {
  return coversMinFormule(formule, gratuit, minFormule);
}

// Part arrondie qui ne dit jamais « 100 % » avant que tout y soit : 199 sur 200
// s'affiche 99 %, pas 100 % (« une étape à 100 % exige 100 % des documents
// prouvés »). Dénominateur nul = 0, jamais NaN.
function percentOf(done: number, total: number): number {
  if (total <= 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.round((done / total) * 100));
}

function pctOf(items: MissionItemProgress[]): number {
  return percentOf(items.filter((i) => i.completed).length, items.length);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return values.every((v) => v === 100) ? 100 : Math.min(99, Math.round(sum / values.length));
}

// Avancement de la mission, en QUATRE ÉTAPES (call du 09/11/2026) :
//   Diagnostic          = cases cochées de la checklist de diagnostic ;
//   Mise en conformité  = documents attendus prouvés ÷ documents attendus (offre de
//                         la mission) — les cases des phases FONDATIONS / DEPLOIEMENT
//                         restent visibles comme jalons et ne la font pas monter ;
//   Suivi, Préparation finale = cases cochées de leur phase.
//   Global = moyenne simple des étapes APPLICABLES.
// Une étape (ou un item) hors offre est RETIRÉE du calcul, jamais comptée 0 : sinon
// une mission Essentiel plafonnerait mécaniquement (§12.4). L'ancienne formule
// (moitié diagnostic, moitié moyenne des phases cochées) affichait « Mise en
// conformité 100 % » sur une mission dont les documents restaient à valider.
export function computeMissionProgress(
  items: MissionItemProgress[],
  formule: CommercialTier | null,
  gratuit: boolean,
  documents: ComplianceDocuments
): MissionProgress {
  const applicable = items.filter((i) => isChecklistItemApplicable(i.minFormule, formule, gratuit));

  const diagnosticPct = pctOf(applicable.filter((i) => i.scope === "DIAGNOSTIC"));

  // Une phase est applicable dès lors qu'au moins un de ses items l'est. Une phase
  // dont tous les items sont hors offre est absente de `phasePcts` : c'est ce qui
  // la fait afficher « — » et grisée côté UI.
  const phasePcts: Partial<Record<MissionChecklistScope, number>> = {};
  for (const scope of PHASE_SCOPES) {
    const scopeItems = applicable.filter((i) => i.scope === scope);
    if (scopeItems.length > 0) phasePcts[scope] = pctOf(scopeItems);
  }

  // La mise en conformité est toujours dans le périmètre : toute offre suit au
  // moins les documents de la loi 2002-2 (offer-scope-service).
  const stepPcts: Partial<Record<MissionStepId, number>> = {
    DIAGNOSTIC: diagnosticPct,
    MISE_EN_CONFORMITE: percentOf(documents.proven, documents.expected),
  };
  if (phasePcts.CONSOLIDATION !== undefined) stepPcts.SUIVI = phasePcts.CONSOLIDATION;
  if (phasePcts.PREPARATION_FINALE !== undefined) stepPcts.PREPARATION_FINALE = phasePcts.PREPARATION_FINALE;

  const globalPct = average(
    MISSION_STEPS.map((step) => stepPcts[step.id]).filter((v): v is number => v !== undefined)
  );

  const counts: MissionProgress["counts"] = {};
  for (const scope of ["DIAGNOSTIC", ...PHASE_SCOPES] as const) {
    const scopeItems = applicable.filter((i) => i.scope === scope);
    if (scopeItems.length > 0) counts[scope] = { done: scopeItems.filter((i) => i.completed).length, total: scopeItems.length };
  }

  return { counts, diagnosticPct, phasePcts, documents, stepPcts, globalPct };
}

// Le calcul ÉCRIT sous chaque pourcentage (retour de Sandrine, 08/11/2026 : « comment
// est-ce calculé ? »). Mêmes nombres que computeMissionProgress, jamais recalculés.
export const MISSION_PROGRESS_NOTE =
  "La mise en conformité compte les documents prouvés (validés par EODA, ou acceptés par la structure en autonomie) ; le diagnostic, le suivi et la préparation finale comptent les cases cochées par EODA dans le suivi de mission.";

export type MissionProgressExplanation = { diagnostic: string; conformite: string; global: string; note: string };

const MILESTONE_LABELS: Partial<Record<MissionPhase, string>> = { FONDATIONS: "fondations", DEPLOIEMENT: "déploiement" };

function describeDocuments(documents: ComplianceDocuments): string {
  const { proven, expected, mode } = documents;
  const who = mode === "ACCOMPAGNE" ? "validés par EODA" : "acceptés par la structure";
  return `${proven} document${proven > 1 ? "s" : ""} prouvé${proven > 1 ? "s" : ""} sur ${expected} attendu${expected > 1 ? "s" : ""} par l'offre (${who}).`;
}

export function explainMissionProgress(progress: MissionProgress): MissionProgressExplanation {
  const diag = progress.counts.DIAGNOSTIC;
  const milestones = (["FONDATIONS", "DEPLOIEMENT"] as const).flatMap((phase) => {
    const pct = progress.phasePcts[phase];
    return pct === undefined ? [] : [`${MILESTONE_LABELS[phase]} ${pct} %`];
  });
  const steps = MISSION_STEPS.flatMap((step) => {
    const pct = progress.stepPcts[step.id];
    return pct === undefined ? [] : [`${step.label} ${pct} %`];
  });
  return {
    diagnostic: diag
      ? `${diag.done} case${diag.done > 1 ? "s" : ""} cochée${diag.done > 1 ? "s" : ""} sur ${diag.total} dans la checklist de diagnostic.`
      : "Aucune case de diagnostic dans cette formule.",
    conformite:
      describeDocuments(progress.documents) +
      (milestones.length > 0 ? ` Jalons cochés, pour information : ${milestones.join(", ")}.` : ""),
    global: `Moyenne des ${steps.length} étapes : ${steps.join(", ")} = ${progress.globalPct} %.`,
    note: MISSION_PROGRESS_NOTE,
  };
}

// Avancement d'une étape, tel que computeMissionProgress l'a calculé.
// `undefined` = étape entièrement hors formule.
export function stepPercent(step: MissionStep, progress: Pick<MissionProgress, "stepPcts">): number | undefined {
  return progress.stepPcts[step.id];
}
