// ─────────────────────────────────────────────────────────────────────────────
// ERREUR DU VERROU HDS (lot C — ADR .claude/specs/adr/20261014_ADR_lot-C-verrou-HDS.md)
//
// Levée par TOUTE écriture de donnée nominative de personne accompagnée tant que le
// backend n'est pas hébergé chez un fournisseur certifié HDS. Ce n'est pas un bug à
// rattraper silencieusement : une action qui la reçoit répond le message honnête
// ci-dessous, rien d'autre.
// ─────────────────────────────────────────────────────────────────────────────

export const HDS_LOCKED_MESSAGE =
  "Cette fonction stocke des données de santé : elle s'ouvrira quand l'hébergement certifié HDS sera en place.";

export class HdsNotAvailableError extends Error {
  constructor(operation: string) {
    super(`${HDS_LOCKED_MESSAGE} (opération refusée : ${operation})`);
    this.name = "HdsNotAvailableError";
  }
}

export function isHdsNotAvailableError(error: unknown): error is HdsNotAvailableError {
  return error instanceof HdsNotAvailableError;
}
