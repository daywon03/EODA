import type { CommercialTier, MissionChecklistScope } from "@eoda/database";
import { coversMinFormule } from "./offer-scope-service";

// Calcul de progression du suivi de mission — pur, sans dépendance Prisma.
// Règles : context/07-outil-pilotage-missions.md §7.3-§7.4 et §12.4.
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
//   Étape 2 Mise en conformité  = FONDATIONS + DEPLOIEMENT (début de la première,
//                                 fin de la seconde ; état dérivé des deux)
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

export type MissionProgress = {
  diagnosticPct: number;
  phasePcts: Partial<Record<MissionChecklistScope, number>>;
  phasesPct: number;
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

function pctOf(items: MissionItemProgress[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Math.round((done / items.length) * 100);
}

// §7.4 : le score global = moyenne simple entre le % diagnostic et le % phases
// (50/50). Le % phases est la moyenne simple des phases *applicables*
// uniquement (jamais pondérée par le nombre d'actions, jamais 0 pour une phase
// exclue — elle est retirée du calcul, pas comptée comme un échec). Même
// traitement pour les items de diagnostic hors offre : ils sont retirés du
// dénominateur, sinon une mission Essentiel plafonnerait mécaniquement à 75 %.
export function computeMissionProgress(
  items: MissionItemProgress[],
  formule: CommercialTier | null,
  gratuit: boolean
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

  const applicableValues = PHASE_SCOPES.map((s) => phasePcts[s]).filter(
    (v): v is number => v !== undefined
  );
  const phasesPct =
    applicableValues.length > 0
      ? Math.round(applicableValues.reduce((a, b) => a + b, 0) / applicableValues.length)
      : 0;

  const globalPct = Math.round((diagnosticPct + phasesPct) / 2);

  return { diagnosticPct, phasePcts, phasesPct, globalPct };
}

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

// Avancement d'une étape : le diagnostic prend celui de sa checklist ; une étape à
// phases prend la moyenne simple de ses phases APPLICABLES (même règle que §7.4).
// `undefined` = étape entièrement hors formule.
export function stepPercent(
  step: MissionStep,
  progress: Pick<MissionProgress, "diagnosticPct" | "phasePcts">
): number | undefined {
  if (step.phases.length === 0) return progress.diagnosticPct;
  const values = step.phases
    .map((phase) => progress.phasePcts[phase])
    .filter((v): v is number => v !== undefined);
  if (values.length === 0) return undefined;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}
