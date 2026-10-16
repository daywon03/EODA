import type { SupportMode } from "@eoda/database";
import type { ClientDocumentState } from "./client-documents-view-service";

// ─────────────────────────────────────────────────────────────────────────────
// PHRASE D'ATTENTE d'une carte « Mes documents » — règle pure.
//
// En autonomie, « Reçu, en cours » (IN_PROGRESS) veut dire : une version est là,
// mais aucune analyse lisible n'est montrée (canClientAcceptDocument l'aurait sinon
// rendue « À vérifier »). Or l'analyse tourne PENDANT le dépôt
// (document-ingestion-service) : quand la carte s'affiche, elle a déjà abouti ou
// échoué. Écrire « la plateforme lit votre document » promettait une réponse qui
// ne viendra pas — un chargement sans fin. On dit ce qui est vrai : l'analyse est
// indisponible, le document est bien reçu.
//
// Accompagnée, l'attente est réelle : EODA relit. Jamais « Sandrine » (D7).
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYSIS_UNAVAILABLE_LINE =
  "Analyse indisponible — votre document est bien reçu. Relisez-le vous-même, ou écrivez à EODA.";

export function clientWaitingLine(state: ClientDocumentState, mode: SupportMode): string | null {
  if (state === "IN_PROGRESS") {
    return mode === "ACCOMPAGNE" ? "EODA relit ce document." : ANALYSIS_UNAVAILABLE_LINE;
  }
  if (state === "TO_PRODUCE") {
    return mode === "ACCOMPAGNE" ? "Vous ne l'avez pas : il est à produire." : "Vous ne l'avez pas : il est à créer.";
  }
  return null;
}
