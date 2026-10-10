import type { UserRole } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// ONGLETS DE LA FICHE STRUCTURE (cabinet) — configuration pure.
//
// Chaque onglet est une ROUTE ENFANT de /dashboard/cabinet/etablissements/[id] :
// l'adresse dit où l'on est, le bouton « Précédent » fonctionne, et chaque page
// re-vérifie l'appartenance de la fiche au tenant (requireEstablishmentInTenant).
//
// Ajouter un onglet = ajouter UNE ligne ici, et la route qui va avec. Les onglets
// Critères, Plan d'action et Équipe de la maquette arrivent avec leurs tranches
// (N4, N5, N10) : tant que l'écran n'existe pas, l'onglet n'existe pas — un onglet
// vide est une donnée factice (D6).
// ─────────────────────────────────────────────────────────────────────────────

export const STRUCTURE_BASE_PATH = "/dashboard/cabinet/etablissements";

const CABINET_ROLES = ["CABINET_ADMIN", "CABINET_EVALUATOR"] as const satisfies readonly UserRole[];

export type StructureTab = {
  id: string;
  label: string;
  // Segment de route sous [id] ; "" = la vue d'ensemble elle-même.
  segment: string;
  // Autres segments qui appartiennent à cet onglet (l'édition de la fiche vit sous
  // Réglages, par exemple).
  alsoMatches?: readonly string[];
  // Rôles qui voient l'onglet. L'affichage suit le rôle ; la PROTECTION reste dans
  // la garde de chaque lecture (masquer un lien n'a jamais fermé une adresse).
  roles: readonly UserRole[];
};

export const STRUCTURE_TABS: readonly StructureTab[] = [
  { id: "overview", label: "Vue d'ensemble", segment: "", roles: CABINET_ROLES },
  { id: "documents", label: "Documents", segment: "documents", roles: CABINET_ROLES },
  { id: "evaluation", label: "Auto-évaluation", segment: "evaluation", roles: CABINET_ROLES },
  { id: "mission", label: "Mission", segment: "mission", roles: CABINET_ROLES },
  { id: "echanges", label: "Échanges", segment: "echanges", roles: CABINET_ROLES },
  { id: "reglages", label: "Réglages", segment: "reglages", alsoMatches: ["modifier"], roles: CABINET_ROLES },
];

export function visibleStructureTabs(role: UserRole, tabs: readonly StructureTab[] = STRUCTURE_TABS): StructureTab[] {
  return tabs.filter((tab) => tab.roles.includes(role));
}

export function structureHref(establishmentId: string, segment = ""): string {
  const base = `${STRUCTURE_BASE_PATH}/${encodeURIComponent(establishmentId)}`;
  return segment ? `${base}/${segment}` : base;
}

// L'onglet actif se lit dans l'adresse : premier segment après l'identifiant
// (« evaluation/chapitre/2 » reste l'onglet Auto-évaluation). Une adresse hors de la
// fiche ne sélectionne rien.
export function activeStructureTabId(
  pathname: string,
  establishmentId: string,
  tabs: readonly StructureTab[] = STRUCTURE_TABS
): string | null {
  const base = structureHref(establishmentId);
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const segment = pathname.slice(base.length).split("/").filter(Boolean)[0] ?? "";
  const tab = tabs.find((t) => t.segment === segment || (t.alsoMatches ?? []).includes(segment));
  return tab?.id ?? null;
}
