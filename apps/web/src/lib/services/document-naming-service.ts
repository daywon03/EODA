// ─────────────────────────────────────────────────────────────────────────────
// CONVENTION DE NOMMAGE EODA — AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe.ext
//
// Obligatoire pour tout export produit par la plateforme (CLAUDE.md §6). Le nom
// n'est pas cosmétique : c'est ce qui permet à Sandrine de retrouver une pièce dans
// un dossier client six mois plus tard, et de la joindre à un e-mail sans la
// renommer.
//
// Extrait de devis-sharing-service le jour où l'avenant a eu besoin de la même
// règle : deux copies auraient fini par produire deux conventions.
//
// Règles PURES.
// ─────────────────────────────────────────────────────────────────────────────

export type EodaDocumentAudience = "Interne" | "Externe";

export type EodaFileNameInput = {
  issuedOn: Date;
  // Type de document en majuscules, tel qu'il apparaît dans la convention : DEVIS,
  // AVENANT, RAPPORT…
  type: string;
  clientName: string;
  objet: string;
  audience: EodaDocumentAudience;
  extension: string;
  // Numéro de version du DOCUMENT, pas du fichier. Reste à 1 pour un document dont
  // l'unicité est déjà portée par son numéro : un devis révisé est un nouveau devis
  // numéroté, jamais une v02 du même.
  version?: number;
};

export function buildEodaFileName(input: EodaFileNameInput): string {
  const date = formatCompactDate(input.issuedOn);
  const version = `v${String(input.version ?? 1).padStart(2, "0")}`;
  const segments = [
    date,
    toFileToken(input.type).toUpperCase(),
    toFileToken(input.clientName),
    toFileToken(input.objet),
    version,
    input.audience,
  ];
  return `${segments.join("_")}.${input.extension}`;
}

function formatCompactDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

// Accents retirés et séparateurs normalisés : un nom de fichier qui traverse une
// pièce jointe, un serveur de messagerie et le poste du client ne doit dépendre ni de
// l'encodage ni de la casse. `_` est réservé au découpage de la convention, il ne peut
// donc pas apparaître à l'intérieur d'un segment.
function toFileToken(value: string): string {
  const withoutAccents = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    withoutAccents
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "Sans-nom"
  );
}
