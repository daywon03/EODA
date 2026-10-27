import { allAdmissionPoints, ADMISSION_HANDED_DOCUMENTS, type HandedDocumentId } from "@/content/admission/explications";
import { otherPrecisionError } from "./prospect-contact-service";
import { DURATION_FIELDS, type DipcBlock, type PreparedDipc } from "./dipc-tablet-preparation";
import { mergePlaceholders } from "./placeholder-merge";
import { cleanName, csvCell, dayOf } from "./survey-roster-service";

// ─────────────────────────────────────────────────────────────────────────────
// ACCUEIL D'UNE NOUVELLE PERSONNE ET SIGNATURE DU DIPEC SUR LA TABLETTE — service PUR
// (demande de Damon, 26/10/2026).
//
// Même frontière que la liste de l'enquête (décision du 22/10, survey-roster-service) :
// l'identité d'une personne accompagnée, son contrat signé et sa signature sont des
// données de santé (ADR 20261014, verrou HDS). Tout se passe donc DANS LE NAVIGATEUR
// de la tablette : saisie, fusion dans le DIPEC validé par EODA, signature, PDF,
// export. Le serveur ne donne que le DIPEC de la structure (document institutionnel)
// et ne reçoit jamais rien en retour. Aucun module serveur n'importe ce fichier
// (`survey-roster-boundary.test.ts`).
//
// « On met le nom une fois et ça se met partout » : la fiche saisie ici alimente
// l'en-tête du contrat, les champs `{{…}}` du DIPEC, la liste des personnes de
// l'enquête, l'index d'export pour Ximi — et porte déjà tout ce que demande le
// formulaire de désignation du SAD du Département (nom de naissance, nom d'époux,
// date de naissance, aide APA / PCH / aide-ménagère, heures en semaine et le
// dimanche, proche à contacter).
// ─────────────────────────────────────────────────────────────────────────────

export type Civility = "MADAME" | "MONSIEUR" | "";
export type AidKind = "APA" | "PCH" | "AIDE_MENAGERE";
export type ContactKind = "PROCHE_AIDANT" | "TUTEUR" | "CURATEUR" | "AUTRE";
export type AdmissionSigner = "PERSONNE" | "REPRESENTANT" | "SERVICE";

export const AID_KIND_LABELS: Record<AidKind, string> = {
  APA: "Allocation personnalisée d'autonomie (APA)",
  PCH: "Prestation de compensation du handicap (PCH)",
  AIDE_MENAGERE: "Aide-ménagère",
};

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  PROCHE_AIDANT: "Proche aidant",
  TUTEUR: "Tuteur",
  CURATEUR: "Curateur",
  AUTRE: "Autre",
};

export const SIGNER_LABELS: Record<AdmissionSigner, string> = {
  PERSONNE: "La personne accompagnée",
  REPRESENTANT: "Son représentant légal",
  SERVICE: "Pour le service",
};

export type AdmissionIdentity = {
  civility: Civility;
  birthName: string;
  usedName: string;
  firstName: string;
  birthDate: string; // AAAA-MM-JJ ou vide
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
};

export type AdmissionAid = {
  kinds: AidKind[];
  startDate: string; // AAAA-MM-JJ ou vide
  weekdayHours: string;
  sundayHours: string;
};

export type AdmissionContact = {
  kind: ContactKind | "";
  otherPrecision: string;
  lastName: string;
  firstName: string;
  address: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
};

export const EMPTY_IDENTITY: AdmissionIdentity = {
  civility: "",
  birthName: "",
  usedName: "",
  firstName: "",
  birthDate: "",
  address: "",
  postalCode: "",
  city: "",
  phone: "",
  email: "",
};
export const EMPTY_AID: AdmissionAid = { kinds: [], startDate: "", weekdayHours: "", sundayHours: "" };
export const EMPTY_CONTACT: AdmissionContact = {
  kind: "",
  otherPrecision: "",
  lastName: "",
  firstName: "",
  address: "",
  postalCode: "",
  city: "",
  phone: "",
  email: "",
};

// Le DIPEC présenté : la version d'EODA, son jour de validation, et l'empreinte du
// texte tel qu'il a été montré (calculée sur la tablette).
export type AdmissionDipcRef = { versionId: string; versionNumber: number; validatedOn: string; sha256: string };

// Ce que la tablette GARDE d'un contrat signé : de quoi lister, retrouver et
// exporter. Le contrat lui-même est le PDF, rangé à côté (jamais régénéré : une
// nouvelle version du DIPEC ne réécrit pas un contrat déjà signé).
export type AdmissionRecord = {
  version: 1;
  id: string;
  personId: string;
  identity: AdmissionIdentity;
  aid: AdmissionAid;
  contact: AdmissionContact | null;
  explanationsVersion: number;
  explained: Record<string, string>; // point → heure ISO
  handed: Partial<Record<HandedDocumentId, string>>;
  signers: AdmissionSigner[];
  // Moment de l'issue : la signature, ou l'enregistrement du refus.
  signedAt: string; // ISO
  staffName: string;
  dipc: AdmissionDipcRef;
  pdfFileName: string;
  pdfSha256: string;
  // Le DIPEC présenté a été signé, ou la personne a refusé de le signer (HAS 1.7.4 :
  // le consentement OU LE REFUS est tracé). Un enregistrement antérieur au 27/10/2026
  // n'a pas ce champ : il se relit comme signé.
  outcome: AdmissionOutcome;
  refusal: AdmissionRefusal | null;
};

export type AdmissionOutcome = "SIGNE" | "REFUS";
// Le motif est facultatif (la personne n'a pas à se justifier) ; la date à laquelle le
// contrat lui sera reproposé, elle, est exigée (HAS 1.7.3 : réinterroger le refus).
export type AdmissionRefusal = { reason: string; reproposeOn: string };
export const REFUSAL_REASON_MAX = 500;

// ── Identité ─────────────────────────────────────────────────────────────────

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const POSTAL_CODE = /^\d{5}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s.-]{6,20}$/;
export const ADMISSION_MAX_FIELD = 120;

function isRealDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day);
}

// Nom d'usage s'il existe, sinon nom de naissance : c'est le nom qu'on lit dans la
// liste et dans un logiciel métier.
export function displayLastName(identity: Pick<AdmissionIdentity, "birthName" | "usedName">): string {
  return cleanName(identity.usedName) || cleanName(identity.birthName);
}

export function fullName(identity: Pick<AdmissionIdentity, "birthName" | "usedName" | "firstName">): string {
  return [displayLastName(identity).toLocaleUpperCase("fr-FR"), cleanName(identity.firstName)].filter(Boolean).join(" ");
}

function lengthProblems(values: Record<string, string>): string[] {
  return Object.values(values).some((value) => value.length > ADMISSION_MAX_FIELD) ? ["Un champ est trop long."] : [];
}

function contactShapeProblems(who: string, fields: { postalCode: string; phone: string; email: string }): string[] {
  return [
    ...(fields.postalCode && !POSTAL_CODE.test(fields.postalCode.trim()) ? [`Le code postal ${who} doit avoir 5 chiffres.`] : []),
    ...(fields.phone && !PHONE.test(fields.phone.trim()) ? [`Le numéro de téléphone ${who} n'est pas valide.`] : []),
    ...(fields.email && !EMAIL.test(fields.email.trim()) ? [`L'adresse e-mail ${who} n'est pas valide.`] : []),
  ];
}

export function identityProblems(identity: AdmissionIdentity, today: Date): string[] {
  return [
    ...(cleanName(identity.birthName) ? [] : ["Écrivez le nom de naissance."]),
    ...(cleanName(identity.firstName) ? [] : ["Écrivez le prénom."]),
    ...(identity.birthDate && !isRealDay(identity.birthDate) ? ["La date de naissance n'est pas valide."] : []),
    ...(identity.birthDate && isRealDay(identity.birthDate) && identity.birthDate > dayOf(today) ? ["La date de naissance est dans le futur."] : []),
    ...contactShapeProblems("de la personne", identity),
    ...lengthProblems(identity),
  ];
}

export function aidProblems(aid: AdmissionAid): string[] {
  const hours = [aid.weekdayHours, aid.sundayHours].filter((h) => h.trim() !== "");
  return [
    ...(aid.startDate && !isRealDay(aid.startDate) ? ["La date de début n'est pas valide."] : []),
    ...(hours.some((h) => !/^\d{1,3}([.,]\d{1,2})?$/.test(h.trim())) ? ["Les heures s'écrivent en chiffres (ex. 12 ou 7,5)."] : []),
  ];
}

export function contactProblems(contact: AdmissionContact | null): string[] {
  if (!contact || !contact.kind) return [];
  const precision = otherPrecisionError(contact.kind, contact.otherPrecision, "le lien avec la personne");
  return [
    ...(precision ? [precision] : []),
    ...(cleanName(contact.lastName) ? [] : ["Écrivez le nom du proche ou du représentant."]),
    ...contactShapeProblems("du proche", contact),
    ...lengthProblems({ ...contact, kind: "" }),
  ];
}

// ── Qui signe ────────────────────────────────────────────────────────────────

// Sous tutelle, le tuteur signe à la place de la personne ; sous curatelle, la
// personne signe, assistée de son curateur, qui signe aussi. Le service signe
// toujours : le DIPEC engage les deux parties.
export function requiredSigners(contact: AdmissionContact | null): AdmissionSigner[] {
  if (contact?.kind === "TUTEUR") return ["REPRESENTANT", "SERVICE"];
  if (contact?.kind === "CURATEUR") return ["PERSONNE", "REPRESENTANT", "SERVICE"];
  return ["PERSONNE", "SERVICE"];
}

export function signerName(signer: AdmissionSigner, identity: AdmissionIdentity, contact: AdmissionContact | null, staffName: string): string {
  if (signer === "PERSONNE") return fullName(identity);
  if (signer === "REPRESENTANT") return contact ? [cleanName(contact.lastName).toLocaleUpperCase("fr-FR"), cleanName(contact.firstName)].filter(Boolean).join(" ") : "";
  return staffName;
}

// ── Ce qui manque avant la signature ─────────────────────────────────────────

export function missingExplanations(explained: Readonly<Record<string, string>>): string[] {
  return allAdmissionPoints()
    .filter((point) => !explained[point.id])
    .map((point) => point.label);
}

export function missingHandedDocuments(handed: Readonly<Partial<Record<HandedDocumentId, string>>>): string[] {
  return ADMISSION_HANDED_DOCUMENTS.filter((doc) => !handed[doc.id]).map((doc) => doc.label);
}

export type SigningDraft = {
  identity: AdmissionIdentity;
  aid: AdmissionAid;
  contact: AdmissionContact | null;
  explained: Readonly<Record<string, string>>;
  handed: Readonly<Partial<Record<HandedDocumentId, string>>>;
  signatures: Readonly<Partial<Record<AdmissionSigner, string>>>;
  unknownDipcFields: readonly string[];
};

export function signingProblems(draft: SigningDraft, today: Date): string[] {
  const missingPoints = missingExplanations(draft.explained);
  const missingDocs = missingHandedDocuments(draft.handed);
  const missingSigners = requiredSigners(draft.contact).filter((signer) => !draft.signatures[signer]);
  const needsRepresentative = draft.contact?.kind === "TUTEUR" || draft.contact?.kind === "CURATEUR";
  return [
    ...identityProblems(draft.identity, today),
    ...aidProblems(draft.aid),
    ...contactProblems(draft.contact),
    ...(draft.unknownDipcFields.length > 0
      ? [`Le DIPEC contient un champ inconnu (${draft.unknownDipcFields.join(", ")}) : EODA doit le corriger avant toute signature.`]
      : []),
    ...(missingPoints.length > 0 ? [`${missingPoints.length} point${missingPoints.length > 1 ? "s" : ""} à expliquer.`] : []),
    ...(missingDocs.length > 0 ? [`Documents pas encore remis : ${missingDocs.join(", ")}.`] : []),
    ...(needsRepresentative && !cleanName(draft.contact?.lastName ?? "") ? ["Le représentant légal n'est pas identifié."] : []),
    ...missingSigners.map((signer) => `Signature manquante : ${SIGNER_LABELS[signer].toLocaleLowerCase("fr-FR")}.`),
  ];
}

// ── Champs du DIPEC ───────────────────────────────────────────────────────────

// EODA peut écrire ces champs dans le DIPEC validé (`{{personne.nom}}`…) : ils sont
// remplis sur la tablette. Un champ inconnu bloque la signature (faute de frappe à
// corriger par EODA) ; un champ connu mais vide laisse une ligne à compléter.
export const ADMISSION_FIELDS = [
  "structure.nom",
  "personne.civilite",
  "personne.nom",
  "personne.nom_naissance",
  "personne.nom_usage",
  "personne.prenom",
  "personne.date_naissance",
  "personne.adresse",
  "personne.code_postal",
  "personne.ville",
  "personne.telephone",
  "personne.email",
  "aide.types",
  "aide.date_debut",
  "aide.heures_semaine",
  "aide.heures_dimanche",
  "proche.lien",
  "proche.nom",
  "proche.prenom",
  "proche.telephone",
  "proche.identite",
  "representant.identite",
  "signataire.nom",
  "intervenant.nom",
  "date.signature",
  "date.revision",
] as const;

export type AdmissionField = (typeof ADMISSION_FIELDS)[number];
export const EMPTY_FIELD_MARK = "…………………";

export function frenchDay(day: string): string {
  if (!DAY.test(day)) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export function contactLink(contact: AdmissionContact | null): string {
  if (!contact?.kind) return "";
  return contact.kind === "AUTRE" ? cleanName(contact.otherPrecision) : CONTACT_KIND_LABELS[contact.kind];
}

export function admissionFieldValues(input: {
  structureName: string;
  identity: AdmissionIdentity;
  aid: AdmissionAid;
  contact: AdmissionContact | null;
  staffName: string;
  signedOn: Date;
}): Record<AdmissionField, string> {
  const { identity, aid, contact } = input;
  return {
    "structure.nom": input.structureName,
    "personne.civilite": identity.civility === "MADAME" ? "Madame" : identity.civility === "MONSIEUR" ? "Monsieur" : "",
    "personne.nom": displayLastName(identity).toLocaleUpperCase("fr-FR"),
    "personne.nom_naissance": cleanName(identity.birthName).toLocaleUpperCase("fr-FR"),
    "personne.nom_usage": cleanName(identity.usedName).toLocaleUpperCase("fr-FR"),
    "personne.prenom": cleanName(identity.firstName),
    "personne.date_naissance": frenchDay(identity.birthDate),
    "personne.adresse": cleanName(identity.address),
    "personne.code_postal": identity.postalCode.trim(),
    "personne.ville": cleanName(identity.city),
    "personne.telephone": identity.phone.trim(),
    "personne.email": identity.email.trim(),
    "aide.types": aid.kinds.map((kind) => AID_KIND_LABELS[kind]).join(", "),
    "aide.date_debut": frenchDay(aid.startDate),
    "aide.heures_semaine": aid.weekdayHours.trim(),
    "aide.heures_dimanche": aid.sundayHours.trim(),
    "proche.lien": contactLink(contact),
    "proche.nom": contact?.kind ? cleanName(contact.lastName).toLocaleUpperCase("fr-FR") : "",
    "proche.prenom": contact?.kind ? cleanName(contact.firstName) : "",
    "proche.telephone": contact?.kind ? contact.phone.trim() : "",
    "proche.identite": contactIdentity(contact, ["PROCHE_AIDANT", "AUTRE"]),
    "representant.identite": contactIdentity(contact, ["TUTEUR", "CURATEUR"]),
    "signataire.nom": signatoryName(identity, contact),
    "intervenant.nom": input.staffName,
    "date.signature": frenchDay(dayOf(input.signedOn)),
    "date.revision": frenchDay(dayOf(oneYearAfter(input.signedOn))),
  };
}

// « Prénom NOM, curateur » si le lien correspond, « sans objet » sinon : le DIPEC
// demande de l'écrire plutôt que de laisser la ligne vide.
function contactIdentity(contact: AdmissionContact | null, kinds: readonly ContactKind[]): string {
  if (!contact?.kind || !kinds.includes(contact.kind)) return "sans objet";
  const name = [cleanName(contact.firstName), cleanName(contact.lastName).toLocaleUpperCase("fr-FR")].filter(Boolean).join(" ");
  return [name, contactLink(contact).toLocaleLowerCase("fr-FR")].filter(Boolean).join(", ");
}

// Qui signe pour la personne, écrit en toutes lettres sur la page de signature du DIPEC.
function signatoryName(identity: AdmissionIdentity, contact: AdmissionContact | null): string {
  const person = fullName(identity);
  if (contact?.kind === "TUTEUR") return `${contactIdentity(contact, ["TUTEUR"])}, pour ${person}`;
  if (contact?.kind === "CURATEUR") return `${person}, assisté(e) de ${contactIdentity(contact, ["CURATEUR"])}`;
  return person;
}

// Révision au moins annuelle (HAS 1.10.6) : la date prévue par défaut.
function oneYearAfter(date: Date): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

// Les zones propres au DIPEC de la structure (« [à compléter] », « ☐ ») s'ajoutent
// aux champs connus : elles ne sont pas inconnues, elles viennent du texte validé.
export function mergeDipcText(dipcText: string, values: Record<AdmissionField, string>, entries: Readonly<Record<string, string>> = {}) {
  const fields = [...ADMISSION_FIELDS, ...Object.keys(entries)];
  return mergePlaceholders(dipcText, fields, { ...values, ...entries } as Record<string, string>, EMPTY_FIELD_MARK);
}

export const CHECKED_MARK = "☒";
export const UNCHECKED_MARK = "☐";

// La copie du DIPEC préparée pour la tablette (dipc-tablet-preparation), remplie bloc
// par bloc. Les champs inconnus de tous les blocs sont réunis : un seul suffit à
// bloquer la signature.
export function mergeDipcBlocks(blocks: readonly DipcBlock[], values: Record<AdmissionField, string>, entries: Readonly<Record<string, string>>) {
  const unknown = new Set<string>();
  const empty = new Set<string>();
  const merged = blocks.map((block) => {
    const result = mergeDipcText(block.text, values, entries);
    result.unknownFields.forEach((f) => unknown.add(f));
    result.emptyFields.forEach((f) => empty.add(f));
    return { ...block, text: result.text };
  });
  return { blocks: merged, unknownFields: [...unknown], emptyFields: [...empty] };
}

// La durée choisie sur la tablette : le numéro de l'option, et les dates si l'option
// est à durée déterminée.
export type DipcDuration = { choice: number | null; start: string; end: string };
export const NO_DURATION: DipcDuration = { choice: null, start: "", end: "" };

// Ce que l'intervenant a saisi ou coché sur la tablette, prêt à fusionner.
export function dipcEntryValues(
  prepared: Pick<PreparedDipc, "freeFields" | "checkFields" | "durationChoice">,
  texts: Readonly<Record<string, string>>,
  checks: Readonly<Record<string, boolean>>,
  duration: DipcDuration = NO_DURATION
): Record<string, string> {
  const options = prepared.durationChoice?.options ?? [];
  const chosen = options.find((o) => o.number === duration.choice);
  return {
    ...Object.fromEntries(prepared.freeFields.map((f) => [f.id, (texts[f.id] ?? "").replace(/\s+/g, " ").trim()])),
    ...Object.fromEntries(prepared.checkFields.map((c) => [c.id, checks[c.id] ? CHECKED_MARK : UNCHECKED_MARK])),
    ...Object.fromEntries(options.map((o) => [DURATION_FIELDS.option(o.number), o.number === duration.choice ? CHECKED_MARK : UNCHECKED_MARK])),
    ...(options.length > 0
      ? {
          [DURATION_FIELDS.start]: chosen?.hasDates ? frenchDay(duration.start) : "",
          [DURATION_FIELDS.end]: chosen?.hasDates ? frenchDay(duration.end) : "",
        }
      : {}),
  };
}

// Durée du contrat : un choix est exigé dès que le DIPEC en propose un ; à durée
// déterminée, les deux dates, dans l'ordre.
export function durationProblems(choice: PreparedDipc["durationChoice"], duration: DipcDuration): string[] {
  if (!choice) return [];
  const chosen = choice.options.find((o) => o.number === duration.choice);
  if (!chosen) return ["Choisissez la durée du contrat."];
  if (!chosen.hasDates) return [];
  if (!isRealDay(duration.start) || !isRealDay(duration.end)) return ["Écrivez les dates de début et de fin du contrat."];
  return duration.end < duration.start ? ["La date de fin du contrat est avant la date de début."] : [];
}

// L'option « durée indéterminée » est proposée d'emblée quand le DIPEC en a une : c'est
// la règle pour un SAD autorisé APA / PCH non habilité à l'aide sociale (CASF L347-1,
// rappelé en note du DIPEC du client pilote) — l'intervenant peut en changer.
export function defaultDuration(choice: PreparedDipc["durationChoice"]): DipcDuration {
  const indefinite = choice?.options.find((o) => /indéterminée/i.test(o.label));
  return { ...NO_DURATION, choice: indefinite?.number ?? null };
}

// ── Fichiers (convention EODA : AAAAMMJJ_TYPE_CLIENT_OBJET_vXX_Interne|Externe) ──

function slug(value: string, max: number, fallback: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, max) || fallback
  );
}

// « Externe » : le contrat (ou l'attestation de refus) est remis à la personne.
export function admissionPdfFileName(structureName: string, identity: AdmissionIdentity, signedAt: Date, outcome: AdmissionOutcome = "SIGNE"): string {
  const person = slug(`${displayLastName(identity)} ${cleanName(identity.firstName)}`, 50, "Personne");
  const type = outcome === "REFUS" ? "REFUS-DIPEC" : "DIPEC";
  return `${dayOf(signedAt).replace(/-/g, "")}_${type}_${slug(structureName, 40, "Structure")}_${person}_v01_Externe.pdf`;
}

// ── Refus de signer (HAS 1.7.3 / 1.7.4) ──────────────────────────────────────

export function refusalProblems(refusal: AdmissionRefusal, today: Date): string[] {
  return [
    ...(isRealDay(refusal.reproposeOn) ? [] : ["Écrivez la date à laquelle le contrat lui sera reproposé."]),
    ...(isRealDay(refusal.reproposeOn) && refusal.reproposeOn < dayOf(today) ? ["La date pour reproposer le contrat est déjà passée."] : []),
    ...(refusal.reason.length > REFUSAL_REASON_MAX ? [`Le motif est trop long (${REFUSAL_REASON_MAX} caractères au plus).`] : []),
  ];
}

// Un mois plus tard, par défaut : assez pour réfléchir, assez tôt pour ne pas perdre le fil.
export function defaultReproposeOn(today: Date): string {
  const next = new Date(today);
  next.setMonth(next.getMonth() + 1);
  return dayOf(next);
}

// ── État d'une personne dans la liste ────────────────────────────────────────

export type AdmissionState = "A_FAIRE" | "SIGNE" | "A_REVOIR" | "REFUS" | "A_REPROPOSER";

export function admissionState(record: AdmissionRecord | null, today: Date): { state: AdmissionState; label: string } {
  if (!record) return { state: "A_FAIRE", label: "DIPEC à faire signer" };
  const on = frenchDay(record.signedAt.slice(0, 10));
  if (record.outcome === "REFUS") {
    const repropose = record.refusal?.reproposeOn ?? "";
    if (!repropose || repropose <= dayOf(today)) return { state: "A_REPROPOSER", label: `Refus le ${on} · à reproposer maintenant` };
    return { state: "REFUS", label: `Refus le ${on} · à reproposer le ${frenchDay(repropose)}` };
  }
  if (isAdmissionDueForReview(record, today)) return { state: "A_REVOIR", label: `Signé le ${on} · à revoir` };
  return { state: "SIGNE", label: `Signé le ${on}` };
}

export function admissionArchiveFileName(structureName: string, today: Date): string {
  return `${dayOf(today).replace(/-/g, "")}_DIPEC_${slug(structureName, 40, "Structure")}_Contrats-signes_v01_Interne.zip`;
}

// ── Index d'export (Ximi, serveur de la structure) ───────────────────────────

export const ADMISSION_EXPORT_HEADER = [
  "Nom de naissance",
  "Nom d'usage",
  "Prénom",
  "Date de naissance",
  "Code postal",
  "Ville",
  "Début de l'accompagnement",
  "Version du DIPEC",
  "Issue",
  "Le",
  "Signataires",
  "À reproposer le",
  "Fichier",
  "Empreinte SHA-256 du PDF",
] as const;

export function buildAdmissionsCsv(records: readonly AdmissionRecord[]): string {
  const lines = [ADMISSION_EXPORT_HEADER.join(";")];
  for (const r of sortAdmissions(records)) {
    lines.push(
      [
        cleanName(r.identity.birthName).toLocaleUpperCase("fr-FR"),
        cleanName(r.identity.usedName).toLocaleUpperCase("fr-FR"),
        cleanName(r.identity.firstName),
        frenchDay(r.identity.birthDate),
        r.identity.postalCode,
        cleanName(r.identity.city),
        frenchDay(r.aid.startDate),
        `v${r.dipc.versionNumber}`,
        r.outcome === "REFUS" ? "Refusé" : "Signé",
        frenchDay(r.signedAt.slice(0, 10)),
        r.signers.map((signer) => SIGNER_LABELS[signer]).join(" + "),
        r.refusal ? frenchDay(r.refusal.reproposeOn) : "",
        r.pdfFileName,
        r.pdfSha256,
      ]
        .map(csvCell)
        .join(";")
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

// ── Liste ────────────────────────────────────────────────────────────────────

export function sortAdmissions(records: readonly AdmissionRecord[]): AdmissionRecord[] {
  return [...records].sort(
    (a, b) =>
      displayLastName(a.identity).localeCompare(displayLastName(b.identity), "fr", { sensitivity: "base" }) ||
      a.identity.firstName.localeCompare(b.identity.firstName, "fr", { sensitivity: "base" }) ||
      b.signedAt.localeCompare(a.signedAt)
  );
}

export function latestAdmissionFor(records: readonly AdmissionRecord[], personId: string): AdmissionRecord | null {
  return records.filter((r) => r.personId === personId).sort((a, b) => b.signedAt.localeCompare(a.signedAt))[0] ?? null;
}

// Le DIPEC se revoit au moins une fois par an (HAS 1.10.6, context/03 périodicités).
export function isAdmissionDueForReview(record: AdmissionRecord, today: Date): boolean {
  const signed = new Date(record.signedAt);
  const due = new Date(signed);
  due.setFullYear(due.getFullYear() + 1);
  return today.getTime() >= due.getTime();
}

// ── Lecture défensive du stockage de la tablette ─────────────────────────────

function str(value: unknown, max = ADMISSION_MAX_FIELD): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function readIdentity(raw: unknown): AdmissionIdentity {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    civility: pick(o.civility, ["MADAME", "MONSIEUR", ""] as const, ""),
    birthName: str(o.birthName),
    usedName: str(o.usedName),
    firstName: str(o.firstName),
    birthDate: str(o.birthDate, 10),
    address: str(o.address),
    postalCode: str(o.postalCode, 10),
    city: str(o.city),
    phone: str(o.phone, 30),
    email: str(o.email),
  };
}

function readContact(raw: unknown): AdmissionContact | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const kind = pick(o.kind, ["PROCHE_AIDANT", "TUTEUR", "CURATEUR", "AUTRE", ""] as const, "");
  if (!kind) return null;
  return {
    kind,
    otherPrecision: str(o.otherPrecision),
    lastName: str(o.lastName),
    firstName: str(o.firstName),
    address: str(o.address),
    postalCode: str(o.postalCode, 10),
    city: str(o.city),
    phone: str(o.phone, 30),
    email: str(o.email),
  };
}

function readStringMap(raw: unknown): Record<string, string> {
  if (typeof raw !== "object" || raw === null) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

const AID_KINDS: readonly AidKind[] = ["APA", "PCH", "AIDE_MENAGERE"];
const SIGNERS: readonly AdmissionSigner[] = ["PERSONNE", "REPRESENTANT", "SERVICE"];

export function parseStoredAdmission(raw: unknown): AdmissionRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || typeof o.id !== "string" || typeof o.personId !== "string" || typeof o.signedAt !== "string") return null;
  const dipc = (typeof o.dipc === "object" && o.dipc !== null ? o.dipc : {}) as Record<string, unknown>;
  const aid = (typeof o.aid === "object" && o.aid !== null ? o.aid : {}) as Record<string, unknown>;
  if (typeof dipc.versionId !== "string" || typeof dipc.versionNumber !== "number" || typeof o.pdfSha256 !== "string") return null;
  return {
    version: 1,
    id: o.id,
    personId: o.personId,
    identity: readIdentity(o.identity),
    aid: {
      kinds: Array.isArray(aid.kinds) ? aid.kinds.filter((k): k is AidKind => AID_KINDS.includes(k as AidKind)) : [],
      startDate: str(aid.startDate, 10),
      weekdayHours: str(aid.weekdayHours, 10),
      sundayHours: str(aid.sundayHours, 10),
    },
    contact: readContact(o.contact),
    explanationsVersion: typeof o.explanationsVersion === "number" ? o.explanationsVersion : 0,
    explained: readStringMap(o.explained),
    handed: readStringMap(o.handed),
    signers: Array.isArray(o.signers) ? o.signers.filter((s): s is AdmissionSigner => SIGNERS.includes(s as AdmissionSigner)) : [],
    signedAt: o.signedAt,
    staffName: str(o.staffName),
    dipc: { versionId: dipc.versionId, versionNumber: dipc.versionNumber, validatedOn: str(dipc.validatedOn, 10), sha256: str(dipc.sha256, 64) },
    pdfFileName: str(o.pdfFileName, 200),
    pdfSha256: o.pdfSha256.slice(0, 64),
    ...readOutcome(o),
  };
}

// Sans champ `outcome` (enregistrement antérieur au 27/10/2026) : un contrat signé.
// Un refus sans date pour le reproposer reste un refus, « à reproposer maintenant ».
function readOutcome(o: Record<string, unknown>): Pick<AdmissionRecord, "outcome" | "refusal"> {
  if (o.outcome !== "REFUS") return { outcome: "SIGNE", refusal: null };
  const refusal = (typeof o.refusal === "object" && o.refusal !== null ? o.refusal : {}) as Record<string, unknown>;
  return { outcome: "REFUS", refusal: { reason: str(refusal.reason, REFUSAL_REASON_MAX), reproposeOn: str(refusal.reproposeOn, 10) } };
}

// La base de la tablette porte la structure dans son nom : une tablette
// ré-enregistrée pour une autre structure ne montre jamais les contrats de la
// précédente (même règle que `rosterStorageKey`).
export function admissionDatabaseName(establishmentId: string): string {
  return `eoda.tablette.dipc.v1.${establishmentId}`;
}
