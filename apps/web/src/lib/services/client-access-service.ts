import {
  CLIENT_ACCESS_ROLES,
  CLIENT_MODULES,
  clientAccessLevel,
  type ClientAccessLevel,
  type ClientAccessRole,
  type ClientModule,
} from "@/lib/auth/capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// ACCÈS À L'ESPACE D'UNE STRUCTURE — règles pures (N9, page « Paramètres »).
//
// Seule la DIRECTION gère les accès, et seulement ceux de SA structure : la garde
// (requireClientEstablishment + module ACCESS) l'assure. Ces règles-ci empêchent la
// structure de s'enfermer dehors : on ne change ni ne retire son propre accès, et la
// dernière direction active reste direction.
//
// Retirer un accès DÉSACTIVE le lien (revokedAt) : l'historique reste visible.
// ─────────────────────────────────────────────────────────────────────────────

export type AccessLinkFacts = { userId: string; accessRole: ClientAccessRole; revokedAt: Date | null };

export type AccessDecision = { ok: true } | { ok: false; error: string };

export function countActiveDirections(links: readonly AccessLinkFacts[]): number {
  return links.filter((link) => !link.revokedAt && link.accessRole === "DIRECTION").length;
}

export function decideClientRoleChange(input: {
  actorId: string;
  target: AccessLinkFacts;
  newRole: ClientAccessRole;
  activeDirectionCount: number;
}): AccessDecision {
  if (input.target.revokedAt) return { ok: false, error: "Cet accès a été retiré." };
  if (input.target.accessRole === input.newRole) return { ok: true };
  if (input.target.userId === input.actorId) {
    return { ok: false, error: "Vous ne pouvez pas changer votre propre rôle." };
  }
  if (input.target.accessRole === "DIRECTION" && input.activeDirectionCount <= 1) {
    return { ok: false, error: "Il faut au moins une personne de la direction." };
  }
  return { ok: true };
}

export function decideClientAccessRevocation(input: {
  actorId: string;
  target: AccessLinkFacts;
  activeDirectionCount: number;
}): AccessDecision {
  if (input.target.revokedAt) return { ok: false, error: "Cet accès est déjà retiré." };
  if (input.target.userId === input.actorId) {
    return { ok: false, error: "Vous ne pouvez pas retirer votre propre accès." };
  }
  if (input.target.accessRole === "DIRECTION" && input.activeDirectionCount <= 1) {
    return { ok: false, error: "Il faut au moins une personne de la direction." };
  }
  return { ok: true };
}

export function parseClientAccessRole(value: unknown): ClientAccessRole | null {
  return typeof value === "string" && (CLIENT_ACCESS_ROLES as readonly string[]).includes(value)
    ? (value as ClientAccessRole)
    : null;
}

// État affiché d'un accès : retiré, invitation en attente (mot de passe temporaire
// jamais changé), ou actif.
export type AccessStatus = "ACTIVE" | "PENDING" | "REVOKED";

export function deriveAccessStatus(facts: { revokedAt: Date | null; mustChangePassword: boolean; isActive: boolean }): AccessStatus {
  if (facts.revokedAt || !facts.isActive) return "REVOKED";
  return facts.mustChangePassword ? "PENDING" : "ACTIVE";
}

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  ACTIVE: "Accès actif",
  PENDING: "Invitation envoyée",
  REVOKED: "Accès retiré",
};

// La matrice rôle × module, telle que « Paramètres » l'affiche.
export function clientPermissionMatrix(): {
  role: ClientAccessRole;
  rows: { module: ClientModule; level: ClientAccessLevel }[];
}[] {
  return CLIENT_ACCESS_ROLES.map((role) => ({
    role,
    rows: CLIENT_MODULES.map((module) => ({ module, level: clientAccessLevel(role, module) })),
  }));
}
