// ─────────────────────────────────────────────────────────────────────────────
// PARTAGE D'UN DEVIS — au plus simple, et sans rien inventer d'irréversible.
//
// Décision de Damon (26/08) : pas d'envoi serveur, pas de jeton de partage public,
// pas de moteur PDF. Deux gestes seulement :
//   1. télécharger le devis (impression navigateur → PDF, nommé selon la convention
//      EODA pour que la pièce jointe soit correcte sans renommage manuel) ;
//   2. ouvrir le brouillon d'e-mail déjà rempli, dans la messagerie de Sandrine.
//
// Un `mailto:` n'envoie rien : il prépare. C'est délibéré — l'e-mail part de la
// vraie boîte de Sandrine, avec sa signature et son historique, et elle relit avant
// d'envoyer. Un envoi serveur aurait exigé une adresse d'expédition, un moteur PDF et
// une file de reprise sur échec pour rendre le même service.
//
// Règles PURES : rien d'autre que des chaînes. Testable sans navigateur.
// ─────────────────────────────────────────────────────────────────────────────

import { formatEuros } from "./price-format-service";

export type DevisShareInput = {
  number: string;
  structureName: string;
  contactEmail: string | null;
  totalAmountEuros: number;
  validUntil: Date | null;
  // Nom de l'expéditrice tel qu'il doit apparaître en signature du brouillon.
  senderName: string;
};

// Convention de nommage EODA (CLAUDE.md §6) :
// AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe.ext
//
// Un devis part chez le client : c'est donc toujours `Externe`. La version reste
// `v01` — le numéro de devis porte déjà l'unicité, et un devis révisé est un
// nouveau document numéroté, jamais une v02 du même.
export function buildDevisFileName(input: { number: string; structureName: string; issuedOn: Date }): string {
  const date = formatCompactDate(input.issuedOn);
  const client = toFileToken(input.structureName);
  const objet = toFileToken(input.number);
  return `${date}_DEVIS_${client}_${objet}_v01_Externe.pdf`;
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

export type MailDraft = { to: string | null; subject: string; body: string };

// Brouillon d'e-mail d'accompagnement du devis. Le montant passe par `formatEuros`,
// point unique de rendu d'un prix : un `toLocaleString` recopié ici rendrait un
// séparateur anglo-saxon sur un runtime small-icu, dans un message envoyé au client.
// Aucune mention « HT » — la TVA n'est pas applicable (art. 293 B du CGI), et le devis
// lui-même porte déjà la mention. Le montant et la validité y figurent
// parce que c'est ce que le prospect cherche en ouvrant le message ; le devis complet
// reste la pièce jointe, qui seule fait foi.
export function buildDevisMailDraft(input: DevisShareInput): MailDraft {
  const lines = [
    "Bonjour,",
    "",
    `Vous trouverez ci-joint le devis ${input.number} pour ${input.structureName}, d'un montant de ${formatEuros(input.totalAmountEuros)}.`,
  ];

  if (input.validUntil) {
    lines.push(`Cette proposition est valable jusqu'au ${formatFrenchDate(input.validUntil)}.`);
  }

  lines.push(
    "",
    "Je reste à votre disposition pour en reprendre le détail ensemble.",
    "",
    "Bien cordialement,",
    input.senderName,
    "EODA Conseil"
  );

  return {
    to: input.contactEmail,
    subject: `Devis ${input.number} — ${input.structureName}`,
    body: lines.join("\n"),
  };
}

// `mailto:` avec sujet et corps encodés. Sans destinataire connu, le lien s'ouvre
// quand même : la messagerie demandera l'adresse, ce qui vaut mieux qu'un bouton mort.
export function buildMailtoUrl(draft: MailDraft): string {
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
  // URLSearchParams encode l'espace en « + », que les clients de messagerie affichent
  // littéralement dans le corps du message.
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${draft.to ?? ""}?${query}`;
}

function formatFrenchDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
