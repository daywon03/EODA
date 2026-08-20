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
  formule: CommercialTier,
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
  formule: CommercialTier,
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
