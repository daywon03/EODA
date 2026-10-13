import type { UserRole } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// MATRICE DES CAPACITÉS — service PUR (tranche N9, 13/10/2026).
//
// Ce fichier DIT qui peut quoi ; il ne refuse rien. Le refus est porté par
// lib/auth/guards.ts, et seulement là (CLAUDE.md §5 bis : une seule couche
// d'autorisation). Un composant peut lire la matrice pour MASQUER un bouton — ce
// n'est jamais une protection, la garde serveur reste la seule qui compte.
//
// Pourquoi une matrice plutôt que des `role === "CABINET_ADMIN"` dispersés : quatre
// rôles cabinet × une dizaine de modules, c'est quarante décisions. Écrites une par
// une dans les actions, elles divergent ; écrites ici, elles se testent toutes
// (capabilities.test.ts parcourt chaque rôle × chaque capacité).
// ─────────────────────────────────────────────────────────────────────────────

export const CABINET_ROLES = [
  "CABINET_ADMIN",
  "CABINET_EVALUATOR",
  "CABINET_COMMERCIAL",
  "CABINET_READONLY",
] as const satisfies readonly UserRole[];

export type CabinetRole = (typeof CABINET_ROLES)[number];

export function isCabinetRole(role: UserRole): role is CabinetRole {
  return (CABINET_ROLES as readonly UserRole[]).includes(role);
}

export const CABINET_CAPABILITIES = [
  // Fiches structure, documents, critères, auto-évaluation, plan d'action, suivi de
  // mission (sans montants), échanges, agenda des accompagnements, journal.
  "STRUCTURES_READ",
  "STRUCTURES_WRITE",
  // Les MONTANTS d'une structure : périmètre contractuel de la mission, contrat,
  // avenant, prix du catalogue proposés au démarrage d'une mission. Une consultante
  // suit la mission sans voir ce que la structure paie (maquette : « Pas la
  // facturation »).
  "STRUCTURE_CONTRACT",
  // Pipeline commercial : prospects, devis, catalogue, signature, demandes d'option.
  "COMMERCIAL",
  // Bibliothèque de modèles EODA, en lecture.
  "LIBRARY_READ",
  // Équipe EODA : inviter, changer un rôle, affecter des structures, retirer l'accès.
  "TEAM_MANAGE",
  // Réglages qui valent pour tout le cabinet ou qui engagent la relation : matrice
  // des critères, documents réclamés, écriture de la bibliothèque, mode
  // d'accompagnement, clôture de mission, suppression d'une fiche.
  "CABINET_SETTINGS",
] as const;

export type CabinetCapability = (typeof CABINET_CAPABILITIES)[number];

const CABINET_MATRIX: Record<CabinetRole, readonly CabinetCapability[]> = {
  CABINET_ADMIN: CABINET_CAPABILITIES,
  CABINET_EVALUATOR: ["STRUCTURES_READ", "STRUCTURES_WRITE", "LIBRARY_READ"],
  // « Prospects et devis. Ne voit pas les documents des structures. »
  CABINET_COMMERCIAL: ["COMMERCIAL"],
  // « Consulte les tableaux de bord. Ne modifie rien. » — et ne voit pas le
  // commercial : les montants d'une structure en font partie (STRUCTURE_CONTRACT).
  CABINET_READONLY: ["STRUCTURES_READ", "LIBRARY_READ"],
};

export function hasCabinetCapability(role: UserRole, capability: CabinetCapability): boolean {
  if (!isCabinetRole(role)) return false;
  return CABINET_MATRIX[role].includes(capability);
}

// Libellés et descriptions des rôles cabinet — ceux de la maquette « Équipe EODA ».
export const CABINET_ROLE_LABELS: Record<CabinetRole, { label: string; description: string }> = {
  CABINET_ADMIN: { label: "Administrateur", description: "Tout : structures, facturation, équipe EODA et rôles." },
  CABINET_EVALUATOR: {
    label: "Consultante",
    description: "Ses structures : relecture, documents, auto-évaluation, mission. Pas la facturation.",
  },
  CABINET_COMMERCIAL: {
    label: "Commercial",
    description: "Prospects, devis et catalogue. Ne voit pas les documents des structures.",
  },
  CABINET_READONLY: { label: "Lecture seule", description: "Consulte les structures et les tableaux de bord. Ne modifie rien." },
};

// Page d'arrivée d'un compte cabinet : un commercial n'a rien à faire sur l'accueil
// des structures, qu'il ne peut pas lire.
export function cabinetLandingPath(role: UserRole): string {
  return hasCabinetCapability(role, "STRUCTURES_READ") ? "/dashboard/cabinet" : "/dashboard/cabinet/commercial";
}

// Page d'arrivée de TOUT compte (racine, /dashboard, middleware après connexion).
export function roleHomePath(role: UserRole): string {
  return role === "CLIENT_USER" ? "/dashboard/client" : cabinetLandingPath(role);
}

// ── Périmètre des structures (affectation consultante) ─────────────────────────
//
// `ALL` : toutes les structures du tenant. `ONLY` : la liste des structures
// affectées. Seul CABINET_EVALUATOR est filtré, et seulement s'il a AU MOINS une
// affectation — sans affectation, il garde tout le portefeuille (compatibilité des
// comptes existants, décision documentée dans schema.prisma). Un rôle sans
// STRUCTURES_READ reçoit `ONLY []` : fail-closed, jamais « tout ».
export type StructureScope = { kind: "ALL" } | { kind: "ONLY"; establishmentIds: readonly string[] };

export function resolveStructureScope(role: UserRole, assignedEstablishmentIds: readonly string[]): StructureScope {
  if (!hasCabinetCapability(role, "STRUCTURES_READ")) return { kind: "ONLY", establishmentIds: [] };
  if (role !== "CABINET_EVALUATOR") return { kind: "ALL" };
  if (assignedEstablishmentIds.length === 0) return { kind: "ALL" };
  return { kind: "ONLY", establishmentIds: [...assignedEstablishmentIds] };
}

export function isInStructureScope(scope: StructureScope, establishmentId: string): boolean {
  return scope.kind === "ALL" || scope.establishmentIds.includes(establishmentId);
}

// ── Besoin d'une action portant sur UN établissement ──────────────────────────
// Une garde partagée (cabinet ou client) reçoit le MODULE touché et le MODE :
// côté cabinet, READ / WRITE se traduisent en STRUCTURES_READ / STRUCTURES_WRITE
// (CONTRACT exige STRUCTURE_CONTRACT) ; côté client, en niveau d'accès du rôle
// dans la structure (matrice client ci-dessous).
export const CLIENT_MODULES = ["DOCUMENTS", "DIAGNOSTIC", "TASKS", "TEAM", "MESSAGES", "CONTRACT", "ACCESS"] as const;
export type ClientModule = (typeof CLIENT_MODULES)[number];
export type AccessMode = "READ" | "WRITE";
export type EstablishmentNeed = { module: ClientModule; mode: AccessMode };
export type StructureAccess = "READ" | "WRITE" | "CONTRACT";

// Besoins nommés, pour que l'appel d'une garde se lise d'un coup d'œil.
export const NEED = {
  DOCUMENTS_READ: { module: "DOCUMENTS", mode: "READ" },
  DOCUMENTS_WRITE: { module: "DOCUMENTS", mode: "WRITE" },
  DIAGNOSTIC_READ: { module: "DIAGNOSTIC", mode: "READ" },
  DIAGNOSTIC_WRITE: { module: "DIAGNOSTIC", mode: "WRITE" },
  TASKS_READ: { module: "TASKS", mode: "READ" },
  TASKS_WRITE: { module: "TASKS", mode: "WRITE" },
  TEAM_READ: { module: "TEAM", mode: "READ" },
  TEAM_WRITE: { module: "TEAM", mode: "WRITE" },
  ACCESS_WRITE: { module: "ACCESS", mode: "WRITE" },
} as const satisfies Record<string, EstablishmentNeed>;

export function cabinetCapabilityFor(access: StructureAccess): CabinetCapability {
  if (access === "CONTRACT") return "STRUCTURE_CONTRACT";
  return access === "WRITE" ? "STRUCTURES_WRITE" : "STRUCTURES_READ";
}

export function structureAccessFor(need: EstablishmentNeed): StructureAccess {
  if (need.module === "CONTRACT") return "CONTRACT";
  return need.mode;
}

// ── Préfixes d'adresse protégés par le middleware ──────────────────────────────
// Filet grossier côté Edge, sur le rôle du JETON. L'autorité reste la garde, qui
// relit le rôle en base ; ce filet évite seulement de servir une coquille de page.
const PATH_CAPABILITIES: readonly (readonly [string, CabinetCapability])[] = [
  ["/dashboard/cabinet/commercial", "COMMERCIAL"],
  ["/imprimer/devis", "COMMERCIAL"],
  ["/dashboard/cabinet/equipe", "TEAM_MANAGE"],
  ["/imprimer/contrat", "STRUCTURE_CONTRACT"],
  ["/imprimer/avenant", "STRUCTURE_CONTRACT"],
];

export function capabilityRequiredForPath(pathname: string): CabinetCapability | null {
  const hit = PATH_CAPABILITIES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? hit[1] : null;
}
