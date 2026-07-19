import type { CommercialTier, MissionChecklistScope } from "@eoda/database";

// Calcul de progression du suivi de mission — pur, sans dépendance Prisma.
// Règles : context/07-outil-pilotage-missions.md §7.3-§7.4

export function isExcellenceScope(formule: CommercialTier, gratuit: boolean): boolean {
  return formule === "EXCELLENCE" || gratuit === true;
}

const RESERVED_SCOPES: MissionChecklistScope[] = ["CONSOLIDATION", "PREPARATION_FINALE"];
const PHASE_SCOPES: MissionChecklistScope[] = [
  "FONDATIONS",
  "DEPLOIEMENT",
  "CONSOLIDATION",
  "PREPARATION_FINALE",
];

// Consolidation et Préparation finale sont grisées/non cochables sauf périmètre
// Excellence (formule EXCELLENCE ou mission gratuite) — §7.3.
export function isScopeApplicable(
  scope: MissionChecklistScope,
  formule: CommercialTier,
  gratuit: boolean
): boolean {
  if (!RESERVED_SCOPES.includes(scope)) return true;
  return isExcellenceScope(formule, gratuit);
}

export type MissionItemProgress = { scope: MissionChecklistScope; completed: boolean };

export type MissionProgress = {
  diagnosticPct: number;
  phasePcts: Partial<Record<MissionChecklistScope, number>>;
  phasesPct: number;
  globalPct: number;
};

function pctOf(items: MissionItemProgress[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.completed).length;
  return Math.round((done / items.length) * 100);
}

// §7.4 : le score global = moyenne simple entre le % diagnostic et le % phases
// (50/50). Le % phases est la moyenne simple des phases *applicables*
// uniquement (jamais pondérée par le nombre d'actions, jamais 0 pour une phase
// exclue — elle est retirée du calcul, pas comptée comme un échec).
export function computeMissionProgress(
  items: MissionItemProgress[],
  formule: CommercialTier,
  gratuit: boolean
): MissionProgress {
  const diagnosticItems = items.filter((i) => i.scope === "DIAGNOSTIC");
  const diagnosticPct = pctOf(diagnosticItems);

  const applicableScopes = PHASE_SCOPES.filter((s) => isScopeApplicable(s, formule, gratuit));
  const phasePcts: Partial<Record<MissionChecklistScope, number>> = {};
  for (const scope of applicableScopes) {
    phasePcts[scope] = pctOf(items.filter((i) => i.scope === scope));
  }

  const applicableValues = applicableScopes.map((s) => phasePcts[s]!);
  const phasesPct =
    applicableValues.length > 0
      ? Math.round(applicableValues.reduce((a, b) => a + b, 0) / applicableValues.length)
      : 0;

  const globalPct = Math.round((diagnosticPct + phasesPct) / 2);

  return { diagnosticPct, phasePcts, phasesPct, globalPct };
}
