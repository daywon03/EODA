import {
  ADMISSION_EXPLANATIONS,
  ADMISSION_HANDED_DOCUMENTS,
  type HandedDocumentId,
} from "@/content/admission/explications";
import {
  AID_KIND_LABELS,
  contactLink,
  frenchDay,
  requiredSigners,
  signerName,
  SIGNER_LABELS,
  type AdmissionAid,
  type AdmissionContact,
  type AdmissionIdentity,
  type AdmissionSigner,
} from "./admission-service";
import { cleanName } from "./survey-roster-service";

// ─────────────────────────────────────────────────────────────────────────────
// PLAN DU CONTRAT SIGNÉ (DIPC) — service PUR.
//
// Une seule description du document, deux rendus : l'aperçu que la personne relit
// sur la tablette AVANT de signer, et le PDF signé (admission-pdf.ts). Deux
// fabrications auraient divergé — ce que la personne a lu ne serait plus ce qu'elle
// a signé (même doctrine que l'aperçu des documents, CLAUDE.md « Voir »).
//
// Le texte du DIPC est celui d'EODA, champs `{{…}}` déjà remplis ; ce service
// n'ajoute AUCUNE clause : il pose l'identité des parties devant, et la trace des
// explications, des remises et des signatures derrière.
// ─────────────────────────────────────────────────────────────────────────────

export type AdmissionBlock =
  | { kind: "title"; text: string }
  | { kind: "subtitle"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "field"; label: string; value: string }
  | { kind: "paragraph"; text: string }
  | { kind: "check"; text: string; detail: string }
  | { kind: "signature"; signer: AdmissionSigner; label: string; name: string; when: string }
  | { kind: "note"; text: string };

export type AdmissionDocumentInput = {
  structureName: string;
  identity: AdmissionIdentity;
  aid: AdmissionAid;
  contact: AdmissionContact | null;
  dipc: { versionNumber: number; validatedOn: string; sha256: string; text: string };
  explained: Readonly<Record<string, string>>;
  handed: Readonly<Partial<Record<HandedDocumentId, string>>>;
  explanationsVersion: number;
  staffName: string;
  // null = aperçu avant signature.
  signedAt: Date | null;
};

const PARIS = "Europe/Paris";

export function frenchTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function frenchDateTime(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: PARIS, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  return `${day} à ${frenchTime(date)}`;
}

const DASH = "—";

function value(text: string): string {
  return cleanName(text) || DASH;
}

function identityBlocks(identity: AdmissionIdentity): AdmissionBlock[] {
  const civility = identity.civility === "MADAME" ? "Madame" : identity.civility === "MONSIEUR" ? "Monsieur" : "";
  return [
    { kind: "heading", text: "La personne accompagnée" },
    ...(civility ? [{ kind: "field" as const, label: "Civilité", value: civility }] : []),
    { kind: "field", label: "Nom de naissance", value: value(identity.birthName.toLocaleUpperCase("fr-FR")) },
    ...(cleanName(identity.usedName) ? [{ kind: "field" as const, label: "Nom d'usage (d'époux ou d'épouse)", value: value(identity.usedName.toLocaleUpperCase("fr-FR")) }] : []),
    { kind: "field", label: "Prénom", value: value(identity.firstName) },
    { kind: "field", label: "Date de naissance", value: frenchDay(identity.birthDate) || DASH },
    { kind: "field", label: "Adresse", value: value([identity.address, `${identity.postalCode} ${identity.city}`].map(cleanName).filter(Boolean).join(", ")) },
    { kind: "field", label: "Téléphone", value: value(identity.phone) },
    { kind: "field", label: "E-mail", value: value(identity.email) },
  ];
}

function aidBlocks(aid: AdmissionAid): AdmissionBlock[] {
  return [
    { kind: "heading", text: "L'aide prévue" },
    { kind: "field", label: "Aide(s)", value: aid.kinds.length > 0 ? aid.kinds.map((k) => AID_KIND_LABELS[k]).join(", ") : DASH },
    { kind: "field", label: "Début de l'accompagnement", value: frenchDay(aid.startDate) || DASH },
    { kind: "field", label: "Heures par mois en semaine", value: value(aid.weekdayHours) },
    { kind: "field", label: "Heures par mois le dimanche", value: value(aid.sundayHours) },
  ];
}

function contactBlocks(contact: AdmissionContact | null): AdmissionBlock[] {
  if (!contact?.kind) return [];
  return [
    { kind: "heading", text: "Proche à contacter ou représentant légal" },
    { kind: "field", label: "Lien", value: value(contactLink(contact)) },
    { kind: "field", label: "Nom et prénom", value: value(`${contact.lastName.toLocaleUpperCase("fr-FR")} ${contact.firstName}`) },
    { kind: "field", label: "Adresse", value: value([contact.address, `${contact.postalCode} ${contact.city}`].map(cleanName).filter(Boolean).join(", ")) },
    { kind: "field", label: "Téléphone", value: value(contact.phone) },
    { kind: "field", label: "E-mail", value: value(contact.email) },
  ];
}

// Le texte du DIPC : un paragraphe par ligne non vide (le texte extrait d'un Word
// sépare ses paragraphes par des retours à la ligne).
export function dipcParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line !== "");
}

function explanationBlocks(explained: Readonly<Record<string, string>>, version: number): AdmissionBlock[] {
  return [
    { kind: "heading", text: "Ce qui a été expliqué à la personne" },
    { kind: "note", text: `Points d'explication, version ${version}. Chaque point a été coché avec la personne, à l'heure indiquée.` },
    ...ADMISSION_EXPLANATIONS.flatMap((section) =>
      section.points.map(
        (point): AdmissionBlock => ({
          kind: "check",
          text: point.label,
          detail: [explained[point.id] ? `expliqué à ${frenchTime(explained[point.id]!)}` : "non expliqué", point.criteria.length > 0 ? `HAS ${point.criteria.join(", ")}` : ""]
            .filter(Boolean)
            .join(" · "),
        })
      )
    ),
  ];
}

function handedBlocks(handed: Readonly<Partial<Record<HandedDocumentId, string>>>): AdmissionBlock[] {
  return [
    { kind: "heading", text: "Documents remis à la personne" },
    ...ADMISSION_HANDED_DOCUMENTS.map(
      (doc): AdmissionBlock => ({ kind: "check", text: doc.label, detail: handed[doc.id] ? `remis à ${frenchTime(handed[doc.id]!)}` : "non remis" })
    ),
  ];
}

function signatureBlocks(input: AdmissionDocumentInput): AdmissionBlock[] {
  const signers = requiredSigners(input.contact);
  const when = input.signedAt ? frenchDateTime(input.signedAt) : "à signer";
  return [
    { kind: "heading", text: "Signatures" },
    {
      kind: "paragraph",
      text: "En signant, les parties reconnaissent que les documents ci-dessus ont été remis, que les explications ci-dessus ont été données, et acceptent le présent document individuel de prise en charge.",
    },
    ...signers.map(
      (signer): AdmissionBlock => ({
        kind: "signature",
        signer,
        label: SIGNER_LABELS[signer],
        name: signerName(signer, input.identity, input.contact, input.staffName) || DASH,
        when,
      })
    ),
    {
      kind: "note",
      text: `Signature électronique simple (article 1367 du Code civil), apposée sur la tablette enregistrée de ${input.structureName}, en présence de ${input.staffName}. Empreinte SHA-256 du texte du DIPC validé par EODA : ${input.dipc.sha256}.`,
    },
  ];
}

export function planAdmissionDocument(input: AdmissionDocumentInput): AdmissionBlock[] {
  return [
    { kind: "title", text: "Document individuel de prise en charge (DIPC)" },
    { kind: "subtitle", text: input.structureName },
    { kind: "note", text: `DIPC version ${input.dipc.versionNumber}, validé par EODA le ${frenchDay(input.dipc.validatedOn) || DASH}.` },
    { kind: "heading", text: "Le service" },
    { kind: "field", label: "Nom", value: value(input.structureName) },
    { kind: "field", label: "Intervenant présent", value: value(input.staffName) },
    ...identityBlocks(input.identity),
    ...aidBlocks(input.aid),
    ...contactBlocks(input.contact),
    { kind: "heading", text: "Le contrat" },
    ...dipcParagraphs(input.dipc.text).map((text): AdmissionBlock => ({ kind: "paragraph", text })),
    ...explanationBlocks(input.explained, input.explanationsVersion),
    ...handedBlocks(input.handed),
    ...signatureBlocks(input),
  ];
}
