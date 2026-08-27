// ─────────────────────────────────────────────────────────────────────────────
// PATERNITÉ DES DOCUMENTS PRODUITS PAR EODA
//
// Dicté le 26/08 : « Il y a aussi une mention en bas de chaque document : créé par
// EODA dans le cadre de l'accompagnement de la structure. Donc propriété EODA, qui
// donne le droit d'exploitation à la structure. Si ça pouvait rester en dur, ça
// serait bien. »
//
// Deux mentions distinctes, et il ne faut pas les confondre :
//
//   - la PATERNITÉ, sur un document qu'EODA a écrit pour la structure (livret,
//     procédure, projet de service remis à jour). Elle affirme une propriété
//     intellectuelle et concède un droit d'usage ;
//   - la mention de PRESTATION, sur un document commercial ou contractuel (devis,
//     avenant). EODA n'y revendique rien : elle propose, ou elle s'engage.
//
// Appliquer la première à un devis reviendrait à prétendre détenir les droits sur
// une offre commerciale — c'est faux, et ça se lit mal.
//
// Fonctions PURES : des chaînes entrent, une chaîne sort.
// ─────────────────────────────────────────────────────────────────────────────

export const EODA_LEGAL_NAME = "EODA Conseil";

// Mention de paternité, en bas des documents PRODUITS pour la structure. Le texte est
// fixe — « si ça pouvait rester en dur, ça serait bien » : c'est une mention
// juridique, elle ne se reformule pas au cas par cas.
export function buildOwnershipMention(establishmentName: string): string {
  const client = establishmentName.trim() || "la structure accompagnée";
  return (
    `Document créé par ${EODA_LEGAL_NAME} dans le cadre de l'accompagnement de ${client}. ` +
    `Propriété de ${EODA_LEGAL_NAME}, qui en concède le droit d'exploitation à ${client}. ` +
    `Reproduction et diffusion hors de ce cadre soumises à autorisation écrite.`
  );
}

// Mention des documents CONTRACTUELS. Elle situe l'émetteur et rappelle la nature de
// la prestation — rien de plus : un devis n'appartient pas à EODA au sens où un
// livret d'accueil réécrit lui appartient.
export function buildContractualMention(establishmentName: string): string {
  const client = establishmentName.trim() || "la structure";
  return (
    `Document établi par ${EODA_LEGAL_NAME} pour ${client}. ` +
    `Prestation de conseil et de préparation à l'évaluation qualité HAS — ` +
    `ne constitue pas une évaluation HAS officielle.`
  );
}
