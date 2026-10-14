import type { UserRole } from "@eoda/database";
import { hasCabinetCapability, type CabinetCapability } from "@/lib/auth/capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// ONGLETS DE LA FICHE STRUCTURE (cabinet) — configuration pure.
//
// Chaque onglet est une ROUTE ENFANT de /dashboard/cabinet/etablissements/[id] :
// l'adresse dit où l'on est, le bouton « Précédent » fonctionne, et chaque page
// re-vérifie l'appartenance de la fiche au tenant (requireEstablishmentInTenant).
//
// Ajouter un onglet = ajouter UNE ligne ici, et la route qui va avec. Tant que
// l'écran n'existe pas, l'onglet n'existe pas — un onglet vide est une donnée
// factice (D6).
//
// La visibilité suit une CAPACITÉ (lib/auth/capabilities.ts), plus un rôle écrit en
// dur : la lecture seule voit les onglets de lecture, pas les Réglages.
// ─────────────────────────────────────────────────────────────────────────────

export const STRUCTURE_BASE_PATH = "/dashboard/cabinet/etablissements";

export type StructureTab = {
  id: string;
  label: string;
  // Segment de route sous [id] ; "" = la vue d'ensemble elle-même.
  segment: string;
  // Autres segments qui appartiennent à cet onglet (l'édition de la fiche vit sous
  // Réglages, par exemple).
  alsoMatches?: readonly string[];
  // Capacité qui fait voir l'onglet. L'affichage suit la capacité ; la PROTECTION
  // reste dans la garde de chaque lecture (masquer un lien n'a jamais fermé une
  // adresse).
  capability: CabinetCapability;
};

export const STRUCTURE_TABS: readonly StructureTab[] = [
  { id: "overview", label: "Vue d'ensemble", segment: "", capability: "STRUCTURES_READ" },
  { id: "documents", label: "Documents", segment: "documents", capability: "STRUCTURES_READ" },
  { id: "criteres", label: "Critères", segment: "criteres", capability: "STRUCTURES_READ" },
  { id: "plan-action", label: "Plan d'action", segment: "plan-action", capability: "STRUCTURES_READ" },
  { id: "evaluation", label: "Auto-évaluation", segment: "evaluation", capability: "STRUCTURES_READ" },
  // Lot B (N10) : équipe de la structure et quiz de sensibilisation.
  { id: "equipe", label: "Équipe et formations", segment: "equipe", capability: "STRUCTURES_READ" },
  // Lot C (terrain) : en lecture côté cabinet — la structure tient les dossiers.
  { id: "personnes", label: "Personnes accompagnées", segment: "personnes", capability: "STRUCTURES_READ" },
  { id: "enquetes", label: "Enquêtes", segment: "enquetes", capability: "STRUCTURES_READ" },
  { id: "mission", label: "Mission", segment: "mission", capability: "STRUCTURES_READ" },
  { id: "echanges", label: "Échanges", segment: "echanges", capability: "STRUCTURES_READ" },
  { id: "reglages", label: "Réglages", segment: "reglages", alsoMatches: ["modifier"], capability: "STRUCTURES_WRITE" },
];

export function visibleStructureTabs(role: UserRole, tabs: readonly StructureTab[] = STRUCTURE_TABS): StructureTab[] {
  return tabs.filter((tab) => hasCabinetCapability(role, tab.capability));
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
