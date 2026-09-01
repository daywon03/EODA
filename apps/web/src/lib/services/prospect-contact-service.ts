import type { AcquisitionChannel, Civility, ContactRole } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITÉ DU CONTACT ET CANAL D'ACQUISITION — règles pures.
//
// Trois champs ont été sortis du texte libre : la civilité (écrite jusqu'ici dans
// le nom, « Madame Dupont »), la fonction, et la précision du canal « Autre ».
// Un nom qui contient sa civilité ne se trie pas, ne s'adresse pas et ne se
// pré-remplit pas dans un devis sans être redécoupé à la main.
//
// Ni Prisma ni session ici — mêmes contraintes que lifecycle-service.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const CIVILITY_LABELS: Record<Civility, string> = {
  MONSIEUR: "Monsieur",
  MADAME: "Madame",
  MADEMOISELLE: "Mademoiselle",
};

// Forme courte, celle qu'on met devant un nom.
const CIVILITY_SHORT: Record<Civility, string> = {
  MONSIEUR: "M.",
  MADAME: "Mme",
  MADEMOISELLE: "Mlle",
};

export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  DIRECTION: "Direction",
  COORDINATION: "Coordination",
  ASSISTANAT: "Assistanat",
  AUTRE: "Autre",
};

export const ACQUISITION_CHANNEL_LABELS: Record<AcquisitionChannel, string> = {
  BOUCHE_A_OREILLE: "Bouche-à-oreille",
  REFERENCEMENT_UNA: "Référencement UNA",
  EMAILING: "Emailing",
  REFERENCEMENT_GOOGLE: "Référencement Google",
  LINKEDIN: "LinkedIn",
  AUTRE: "Autre",
};

// « Autre » sans précision n'enregistre pas une information : il enregistre qu'on ne
// sait pas. La règle vaut pour le canal comme pour la fonction — une seule fonction
// pour les deux, sinon l'une des deux finira par ne plus la vérifier.
export function otherPrecisionError(
  value: "AUTRE" | string | null,
  precision: string | null,
  label: string
): string | null {
  if (value !== "AUTRE") return null;
  if (precision && precision.trim().length > 0) return null;
  return `Précisez ${label} lorsque vous choisissez « Autre ».`;
}

// La précision n'a de sens qu'avec « Autre ». La garder après un changement de
// valeur laisserait un commentaire orphelin qui contredit le champ affiché.
export function keepPrecisionOnlyForOther(
  value: "AUTRE" | string | null,
  precision: string | null
): string | null {
  return value === "AUTRE" ? precision : null;
}

// « Mme Dupont (Direction) ». Chaque morceau est facultatif : un prospect peut
// n'avoir qu'un nom, ou même rien — l'appelant reçoit alors `null` et décide
// lui-même quoi afficher, plutôt qu'une chaîne vide qui traverserait l'écran.
export function formatContactIdentity(contact: {
  civility: Civility | null;
  contactName: string | null;
  contactRole: ContactRole | null;
  contactRoleOther: string | null;
}): string | null {
  const name = [contact.civility ? CIVILITY_SHORT[contact.civility] : null, contact.contactName]
    .filter((part): part is string => !!part)
    .join(" ");

  const role = describeContactRole(contact);

  if (!name) return role;
  return role ? `${name} (${role})` : name;
}

// La précision saisie l'emporte sur le libellé « Autre » : afficher « Autre » quand
// on a écrit « Chargée de mission qualité » perdrait l'information au moment précis
// où elle est utile.
export function describeContactRole(contact: {
  contactRole: ContactRole | null;
  contactRoleOther: string | null;
}): string | null {
  if (!contact.contactRole) return null;
  if (contact.contactRole === "AUTRE") {
    return contact.contactRoleOther ?? CONTACT_ROLE_LABELS.AUTRE;
  }
  return CONTACT_ROLE_LABELS[contact.contactRole];
}

export function describeAcquisitionChannel(prospect: {
  channel: AcquisitionChannel;
  channelOther: string | null;
}): string {
  if (prospect.channel === "AUTRE" && prospect.channelOther) {
    // Le canal reste « Autre » pour les agrégats ; seul l'affichage est enrichi.
    return `${ACQUISITION_CHANNEL_LABELS.AUTRE} — ${prospect.channelOther}`;
  }
  return ACQUISITION_CHANNEL_LABELS[prospect.channel];
}
