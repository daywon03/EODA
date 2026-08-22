import type { DevisStatus } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE DE VIE D'UN DEVIS — table de transitions, source unique
//
// Cette table était auparavant écrite dans le composant client
// `components/devis/DevisStatusActions.tsx`, et nulle part côté serveur :
// `changeDevisStatus(id, status)` acceptait n'importe quelle valeur reçue de la
// route HTTP publique qu'est une action serveur (constat N4 de l'audit). Une UI
// n'est pas un contrôle. La table vit donc ici, pure et testée, et le composant
// comme l'action la consomment — un seul endroit à corriger (D1).
//
// Règles métier (context/07-outil-pilotage-missions.md §6.3) :
//  - un BROUILLON se modifie et se supprime : rien de commercial n'a eu lieu,
//    son numéro n'a jamais circulé ;
//  - un devis émis (ENVOYE, SIGNE) ne se supprime jamais — il s'ANNULE. La ligne
//    et son numéro restent en base : une série commerciale numérotée
//    (DEVIS-AAAA-NNN) ne doit pas comporter de trou ;
//  - REFUSE et ANNULE sont terminaux. Une annulation ne se défait pas : si la
//    prestation repart, c'est un nouveau devis, avec un nouveau numéro.
// ─────────────────────────────────────────────────────────────────────────────

export const DEVIS_ALLOWED_TRANSITIONS: Record<DevisStatus, readonly DevisStatus[]> = {
  BROUILLON: ["ENVOYE", "REFUSE"],
  ENVOYE: ["SIGNE", "REFUSE", "ANNULE"],
  SIGNE: ["ANNULE"],
  REFUSE: [],
  ANNULE: [],
};

export function canTransitionDevis(from: DevisStatus, to: DevisStatus): boolean {
  return DEVIS_ALLOWED_TRANSITIONS[from].includes(to);
}

// Modification du contenu (formule, options, acompte, échéances) : brouillon
// uniquement. Un devis émis a été lu par le prospect ; le corriger en place
// falsifierait ce qu'il a reçu.
export function isDevisEditable(status: DevisStatus): boolean {
  return status === "BROUILLON";
}

// Suppression réelle de la ligne : brouillon uniquement, cf. en-tête.
export function isDevisDeletable(status: DevisStatus): boolean {
  return status === "BROUILLON";
}

// Un devis annulé n'existe plus commercialement : il ne doit compter dans aucun
// indicateur (ni au numérateur, ni au dénominateur). Sans ce filtre, une annulation
// laisse le montant dans le « CA signé » ou dans le pipeline pondéré — exactement
// le genre d'erreur qui ne se voit pas.
export function isDevisCountedInKpi(status: DevisStatus): boolean {
  return status !== "ANNULE";
}
