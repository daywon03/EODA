import type { UserRole } from "@eoda/database";
import { isInStructureScope, resolveStructureScope } from "@/lib/auth/capabilities";

// ─────────────────────────────────────────────────────────────────────────────
// QUI, AU CABINET, EST PRÉVENU QU'UNE STRUCTURE A BOUGÉ — service PUR.
//
// Le pendant cabinet de `findClientRecipients` : quand la structure dépose une
// pièce, accepte un document ou répond « je ne l'ai pas », ce n'est pas une seule
// personne qui doit le savoir, c'est quiconque SUIT cette structure.
//
// Ce qui décide n'est donc pas un rôle écrit ici, mais le PÉRIMÈTRE déjà en vigueur
// partout ailleurs : `resolveStructureScope` (une consultante ne voit que ses
// structures affectées, aucune sans affectation ; un rôle sans
// `STRUCTURES_READ` ne voit rien). Réutiliser cette règle plutôt que d'en écrire une
// seconde est le seul moyen qu'une alerte ne finisse pas par annoncer à une
// commerciale l'activité documentaire d'une structure qu'elle n'a pas le droit
// d'ouvrir — les documents d'une structure ne la concernent pas.
//
// Un compte désactivé ne reçoit rien : sa désactivation EST la décision de couper.
// ─────────────────────────────────────────────────────────────────────────────

export type CabinetRecipientCandidate = {
  name: string | null;
  email: string;
  role: UserRole;
  isActive: boolean;
  // Les structures affectées à cette personne (`EstablishmentAssignment`, suppression
  // franche : il n'y a pas de révocation à filtrer).
  assignedEstablishmentIds: readonly string[];
};

export function selectStructureRecipients(
  candidates: readonly CabinetRecipientCandidate[],
  establishmentId: string
): { name: string | null; email: string }[] {
  const seen = new Set<string>();
  const recipients: { name: string | null; email: string }[] = [];

  for (const candidate of candidates) {
    if (!candidate.isActive) continue;
    // Une seule règle, une seule implémentation : `resolveStructureScope` porte déjà
    // le fail-closed (un rôle sans STRUCTURES_READ rend `ONLY []`, jamais `ALL`).
    const scope = resolveStructureScope(candidate.role, candidate.assignedEstablishmentIds);
    if (!isInStructureScope(scope, establishmentId)) continue;

    // Déduplication par adresse : deux comptes pour la même boîte (un ancien, un
    // nouveau) feraient deux fois la même annonce.
    const email = candidate.email.trim();
    if (email.length === 0 || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ name: candidate.name, email });
  }

  return recipients;
}
