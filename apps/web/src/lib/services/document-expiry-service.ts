import type { DocumentStatus, ExpectedFrequency } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS PÉRIMÉS — le troisième état attendu par le cahier des charges.
//
// Le CDC demande un suivi « reçu / manquant / À METTRE À JOUR » (§5). Le statut
// `EXPIRED` existait dans l'énumération depuis le Jalon 3 et n'était jamais posé :
// une checklist annonçait « conforme » sur un compte rendu de CVS de 2023.
//
// Il est DÉRIVÉ, jamais stocké : la péremption dépend de l'horloge, et un statut
// figé en base serait faux le lendemain sans que personne n'écrive quoi que ce soit.
// C'est la même règle que le cycle de vie d'une mission — on calcule.
//
// `now` est un paramètre : un service qui lit l'horloge ne se teste pas.
// ─────────────────────────────────────────────────────────────────────────────

// Durée de validité par fréquence attendue. `ON_DEMAND` n'a pas d'échéance : le
// document est produit quand il est demandé, il ne se périme pas tout seul.
const VALIDITY_MONTHS: Record<ExpectedFrequency, number | null> = {
  ANNUAL: 12,
  BIANNUAL: 24,
  TRIENNIAL: 36,
  ON_DEMAND: null,
};

// Mois pleins écoulés, en calendrier. Un décompte en tranches de 30 jours dériverait
// d'un mois tous les six ans, et ferait périmer un document la veille de sa date
// anniversaire.
export function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return to.getDate() >= from.getDate() ? months : months - 1;
}

export type ExpiryFacts = {
  expectedFrequency: ExpectedFrequency | null;
  // Date de la version courante. Null si rien n'a jamais été déposé — un document
  // absent est MANQUANT, pas périmé.
  currentVersionAt: Date | null;
};

export function isExpired(facts: ExpiryFacts, now: Date): boolean {
  if (!facts.expectedFrequency || !facts.currentVersionAt) return false;

  const validity = VALIDITY_MONTHS[facts.expectedFrequency];
  if (validity === null) return false;

  return monthsBetween(facts.currentVersionAt, now) >= validity;
}

// Statut EFFECTIF affiché. La péremption ne remplace que les états « on a quelque
// chose » : un document manquant reste manquant, un document hors périmètre reste
// non applicable, et un document en cours d'analyse n'est pas encore jugeable.
const OVERRIDABLE: DocumentStatus[] = ["COMPLIANT", "UPLOADED", "INCOMPLETE"];

export function applyExpiry(
  status: DocumentStatus,
  facts: ExpiryFacts,
  now: Date
): DocumentStatus {
  if (!OVERRIDABLE.includes(status)) return status;
  return isExpired(facts, now) ? "EXPIRED" : status;
}

// Ce qu'il faut faire, en une phrase. Le statut dit « périmé » ; cette phrase dit
// depuis quand et pourquoi — sans quoi le client répond « mais je vous l'ai envoyé ».
export function describeExpiry(facts: ExpiryFacts, now: Date): string | null {
  if (!isExpired(facts, now) || !facts.currentVersionAt || !facts.expectedFrequency) return null;

  const months = monthsBetween(facts.currentVersionAt, now);
  const years = Math.floor(months / 12);
  const age =
    years >= 1
      ? `${years} an${years > 1 ? "s" : ""}`
      : `${months} mois`;

  return `Cette version date de plus de ${age} : une mise à jour est attendue.`;
}
