import type { EstablishmentType, StructureType } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITÉ D'UNE STRUCTURE — FINESS, SIRET, adresse, type de SAD, échéance HAS.
//
// Ces informations se connaissent souvent dès le premier contact, et se
// saisissaient jusqu'ici seulement à la SIGNATURE. Résultat : on les avait sous les
// yeux en réunion de découverte, on ne pouvait pas les noter, et il fallait les
// retrouver des semaines plus tard au moment de créer la fiche.
//
// Elles vivent donc sur le PROSPECT, facultatives (on ne les a pas toujours), et sont
// RECOPIÉES sur la fiche à la signature — même règle que `structureType`, déjà en
// place : « saisi une seule fois, recopié à la signature, jamais redemandé ; une
// seconde saisie du même fait finit par diverger » (CLAUDE.md §7).
//
// Ce que ce fichier ne fait PAS : rendre ces champs obligatoires au stade prospect.
// Un prospect dont on ne connaît que le nom et un numéro de téléphone doit pouvoir
// entrer dans le pipeline — c'est même le cas le plus fréquent.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

// Un FINESS est un numéro à 9 chiffres. Contrôle de FORME seulement : la validité
// réelle se vérifie au répertoire FINESS, pas ici. On refuse néanmoins ce qui ne peut
// pas en être un — un FINESS faux sur un livrable remis à la HAS est un vrai problème.
const FINESS_PATTERN = /^\d{9}$/;

export function normaliseFiness(raw: string | null): string | null {
  if (raw === null) return null;
  // Espaces et points de séparation retirés : « 93 00 34 459 » est le même numéro que
  // « 930034459 », et refuser la première forme n'apprend rien à personne.
  const compact = raw.replace(/[\s.-]/g, "");
  return compact.length === 0 ? null : compact;
}

export function finessFormatError(value: string | null): string | null {
  if (value === null || value.length === 0) return null;
  if (FINESS_PATTERN.test(value)) return null;
  return "Le numéro FINESS doit comporter 9 chiffres.";
}

// Un SIRET est un numéro à 14 chiffres (SIREN sur 9 + NIC sur 5). Contrôle de FORME
// seulement, comme le FINESS : la clé de Luhn n'est pas vérifiée ici — une saisie qui
// passerait Luhn mais désignerait une autre entreprise ne serait pas moins fausse, et
// le seul contrôle qui vaut est la confrontation à l'avis de situation INSEE.
//
// ⚠️ FINESS et SIRET ne disent PAS la même chose, et ne se remplacent jamais. Le
// FINESS identifie l'ESSMS auprès des autorités sanitaires et sociales — c'est lui qui
// désigne la structure évaluée par la HAS. Le SIRET identifie l'établissement au
// registre des entreprises : c'est la mention qui doit figurer sur un devis, un
// contrat et une facture. Une structure a besoin des deux, pour deux usages qui ne se
// croisent pas.
//
// Correction explicite de Sandrine (call du 01/09) : « je t'avais dit que les
// associations SAD n'avaient pas de SIRET. Apparemment, si. Rajouter le numéro de
// SIRET pour TOUS les formats de structure. » Le champ ne dépend donc d'aucun statut
// juridique.
const SIRET_PATTERN = /^\d{14}$/;

export function normaliseSiret(raw: string | null): string | null {
  // Même normalisation que le FINESS : le SIRET s'écrit couramment par groupes
  // (« 802 341 209 00016 »), et refuser cette forme n'apprend rien à personne.
  if (raw === null) return null;
  const compact = raw.replace(/[\s.-]/g, "");
  return compact.length === 0 ? null : compact;
}

export function siretFormatError(value: string | null): string | null {
  if (value === null || value.length === 0) return null;
  if (SIRET_PATTERN.test(value)) return null;
  return "Le numéro SIRET doit comporter 14 chiffres.";
}

// Valeurs d'identité portées par un prospect.
export type StructureIdentity = {
  finessNumber: string | null;
  siretNumber: string | null;
  address: string | null;
  establishmentType: EstablishmentType | null;
  hasEvaluationTargetDate: Date | null;
};

// Ce que le formulaire de signature doit afficher PRÉ-REMPLI. La règle est simple et
// vaut la peine d'être testée : ce que la signature reçoit gagne toujours (c'est la
// dernière parole, prononcée au moment d'engager), et le prospect ne sert qu'à ne pas
// repartir d'une page blanche.
export function resolveSignatureDefaults(input: {
  prospect: StructureIdentity;
  // Fiche déjà existante (prospect rattaché avant la signature) : ses valeurs
  // priment sur celles du prospect — c'est la fiche qui fait foi une fois créée.
  establishment: StructureIdentity | null;
}): StructureIdentity {
  const { prospect, establishment } = input;
  if (establishment === null) return prospect;

  return {
    finessNumber: establishment.finessNumber ?? prospect.finessNumber,
    siretNumber: establishment.siretNumber ?? prospect.siretNumber,
    address: establishment.address ?? prospect.address,
    establishmentType: establishment.establishmentType ?? prospect.establishmentType,
    hasEvaluationTargetDate:
      establishment.hasEvaluationTargetDate ?? prospect.hasEvaluationTargetDate,
  };
}

// Résumé d'identité en une ligne. Les champs absents sont OMIS et non remplacés par
// un tiret : « FINESS : — » a l'air d'un formulaire mal rempli, alors qu'il s'agit
// d'une information qu'on n'a simplement pas encore.
//
// SEULE fonction à composer cette ligne. Il en existait deux — celle-ci pour la fiche
// prospect, `describeStructureIdentity` dans contract-service pour l'en-tête du
// contrat — et c'est précisément le cas que D1 décrit : ajouter le SIRET aurait été un
// correctif à appliquer deux fois, donc appliqué une fois. Le contrat préfixe le NOM
// de la structure (il désigne une partie au contrat), la fiche non (le nom est déjà le
// titre de la page) : c'est la seule différence, elle devient un paramètre.
export function describeStructureIdentityLine(
  identity: Pick<StructureIdentity, "finessNumber" | "siretNumber" | "address"> & {
    structureName?: string;
  }
): string | null {
  const parts: string[] = [];
  if (identity.structureName && identity.structureName.trim().length > 0) {
    parts.push(identity.structureName.trim());
  }
  if (identity.address && identity.address.trim().length > 0) parts.push(identity.address.trim());
  if (identity.finessNumber && identity.finessNumber.trim().length > 0) {
    parts.push(`FINESS ${identity.finessNumber.trim()}`);
  }
  if (identity.siretNumber && identity.siretNumber.trim().length > 0) {
    parts.push(`SIRET ${identity.siretNumber.trim()}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Statut juridique — libellés uniques. Ils étaient écrits deux fois, et pas dans les
// mêmes termes : « Association » sur la fiche prospect, « Association loi 1901 » sur
// la fiche client. Le même fait changeait de nom en franchissant la signature, ce qui
// se lit comme une donnée qui a changé. Les termes retenus sont ceux du support
// commercial d'EODA.
export const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  ASSOCIATION: "Association loi 1901",
  PRIVE: "Secteur privé",
  PUBLIC: "CCAS / CIAS ou autre organisme public",
};

export const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  SAD_AIDE: "SAD aide",
  SAD_MIXTE: "SAD mixte (aide et soins)",
};

// Un FINESS déjà rattaché à une fiche client. Message ici et non dans l'action : il
// devient probable maintenant que le numéro se saisit dès le prospect (deux fiches de
// prospection peuvent porter le même), et il ne doit surtout pas être confondu avec
// le refus de course entre deux signatures simultanées — lequel annonce « conversion
// déjà enregistrée », c'est-à-dire le contraire de ce qui s'est passé.
export function finessConflictError(alreadyUsed: boolean): string | null {
  if (!alreadyUsed) return null;
  return (
    "Ce numéro FINESS est déjà rattaché à une fiche client. " +
    "Vérifiez qu'il ne s'agit pas de la même structure."
  );
}
