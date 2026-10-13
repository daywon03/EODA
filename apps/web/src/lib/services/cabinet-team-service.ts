import type { UserRole } from "@eoda/database";
import { CABINET_ROLES, type CabinetRole } from "@/lib/auth/capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// ÉQUIPE EODA — règles pures (tranche N9, maquette « Équipe EODA »).
//
// Deux interdits qui ne se négocient pas, parce qu'ils fermeraient le cabinet à
// lui-même :
//   - on ne retire jamais SON propre accès, ni ne change SON propre rôle (une
//     erreur de clic suffirait à se mettre dehors) ;
//   - le dernier administrateur actif ne perd ni son accès ni son rôle (plus
//     personne ne pourrait inviter, affecter ou rétablir quoi que ce soit).
// Les actions (lib/actions/cabinet-team.ts) relisent les faits en base et appellent
// ces fonctions ; l'écran ne fait que masquer le bouton.
// ─────────────────────────────────────────────────────────────────────────────

export type TeamMemberFacts = { id: string; role: UserRole; isActive: boolean };

export function countActiveAdmins(members: readonly TeamMemberFacts[]): number {
  return members.filter((member) => member.isActive && member.role === "CABINET_ADMIN").length;
}

export type TeamDecision = { ok: true } | { ok: false; error: string };

const ALLOWED: TeamDecision = { ok: true };

export function decideAccessRemoval(input: {
  actorId: string;
  target: TeamMemberFacts;
  activeAdminCount: number;
}): TeamDecision {
  if (input.target.id === input.actorId) {
    return { ok: false, error: "Vous ne pouvez pas retirer votre propre accès." };
  }
  if (!input.target.isActive) return { ok: false, error: "Cet accès est déjà retiré." };
  if (input.target.role === "CABINET_ADMIN" && input.activeAdminCount <= 1) {
    return { ok: false, error: "C'est le dernier administrateur : son accès ne peut pas être retiré." };
  }
  return ALLOWED;
}

export function decideRoleChange(input: {
  actorId: string;
  target: TeamMemberFacts;
  newRole: CabinetRole;
  activeAdminCount: number;
}): TeamDecision {
  if (input.target.role === input.newRole) return ALLOWED;
  if (input.target.id === input.actorId) {
    return { ok: false, error: "Vous ne pouvez pas changer votre propre rôle." };
  }
  if (input.target.role === "CABINET_ADMIN" && input.target.isActive && input.activeAdminCount <= 1) {
    return { ok: false, error: "C'est le dernier administrateur : son rôle ne peut pas changer." };
  }
  return ALLOWED;
}

// Seule une consultante est affectée à des structures (« Ses structures ») : pour
// les autres rôles, la liste est vidée — l'administration et la lecture seule voient
// tout, le commercial ne voit aucune structure. Les identifiants reçus sont filtrés
// sur ceux du tenant : un identifiant étranger est ignoré, jamais écrit.
export function normalizeAssignments(
  role: CabinetRole,
  requestedIds: readonly string[],
  tenantEstablishmentIds: readonly string[]
): string[] {
  if (role !== "CABINET_EVALUATOR") return [];
  const allowed = new Set(tenantEstablishmentIds);
  return [...new Set(requestedIds)].filter((id) => allowed.has(id));
}

export function parseCabinetRole(value: unknown): CabinetRole | null {
  return typeof value === "string" && (CABINET_ROLES as readonly string[]).includes(value)
    ? (value as CabinetRole)
    : null;
}

// « Structures : … » d'une ligne de l'écran. Sans affectation, une consultante suit
// toutes les structures — l'écran le dit plutôt que d'afficher une liste vide.
export function describeFollowedStructures(role: UserRole, structureNames: readonly string[]): string {
  if (role === "CABINET_COMMERCIAL") return "Aucune (commercial)";
  if (role !== "CABINET_EVALUATOR" || structureNames.length === 0) return "Toutes";
  return structureNames.join(", ");
}

export function countByRole(members: readonly TeamMemberFacts[]): Record<CabinetRole, number> {
  const counts = Object.fromEntries(CABINET_ROLES.map((role) => [role, 0])) as Record<CabinetRole, number>;
  for (const member of members) {
    if (!member.isActive) continue;
    if ((CABINET_ROLES as readonly string[]).includes(member.role)) counts[member.role as CabinetRole] += 1;
  }
  return counts;
}
