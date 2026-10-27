import { frenchDay, type AdmissionRecord } from "./admission-service";
import { cleanName, dayOf } from "./survey-roster-service";

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRE DU DÉPARTEMENT (93) — « APA, PCH ou aide-ménagère : désignation du
// service autonomie à domicile, déclaration initiale » — rempli depuis la fiche
// saisie UNE fois sur la tablette (demande de Damon, 27/10/2026). Service PUR.
//
// Le PDF officiel n'a aucun champ remplissable (vérifié le 26/10) : on ÉCRIT
// PAR-DESSUS, à des coordonnées mesurées sur ce fichier précis (pdfplumber, 27/10 ;
// origine en bas à gauche, en points). Son empreinte SHA-256 est figée : si le
// Département publie une autre version, le remplissage est REFUSÉ plutôt que
// d'écrire à côté des cases.
//
// Le formulaire doit partir au Département « obligatoirement accompagné d'une copie
// du contrat de prestation » (prestations-saad@seinesaintdenis.fr) : c'est la
// structure qui l'envoie, depuis la tablette ou son poste — jamais EODA.
// Même frontière que le contrat : aucun module serveur n'importe ce fichier.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPARTEMENT_FORM = {
  path: "/formulaires/93-designation-sad-declaration-initiale-2026.pdf",
  sha256: "9f8b120e3b69f66c3b8d263b162d108a0f0d8faf8c04ac98703752803571e571",
  title: "Désignation du service autonomie à domicile — déclaration initiale (Département 93)",
  sendTo: "prestations-saad@seinesaintdenis.fr",
} as const;

export type FormItem =
  | { page: number; kind: "text"; x: number; y: number; text: string; maxWidth: number; maxLines?: number }
  | { page: number; kind: "check"; cx: number; y: number }
  | { page: number; kind: "image"; x: number; y: number; maxWidth: number; maxHeight: number };

export type DepartementFormInput = {
  record: AdmissionRecord;
  structure: { name: string; address: string };
  // Gestes de la personne sur la tablette, jamais présumés.
  certifies: boolean;
  acceptsTransmission: boolean;
  signedOn: Date;
  withSignature: boolean;
};

// Positions des petites cases « _ » des dates et du code postal (x de début).
const BIRTH_DATE_SLOTS = [386.8, 397.8, 420.1, 431.2, 453.5, 464.5, 475.4, 486.5];
const POSTAL_SLOTS = [110.8, 121.8, 132.8, 143.8, 154.8];
// Une case du formulaire est le glyphe juste avant son libellé : son centre est à
// 7,1 points à gauche du premier mot (mesuré sur « Allocation », « en », « Mme »).
const BOX_OFFSET = 7.1;

function slots(digits: string, positions: readonly number[], page: number, y: number): FormItem[] {
  return [...digits].slice(0, positions.length).map((digit, i) => ({ page, kind: "text", x: positions[i]! + 0.6, y, text: digit, maxWidth: 8 }));
}

function upper(value: string): string {
  return cleanName(value).toLocaleUpperCase("fr-FR");
}

function text(page: number, x: number, y: number, value: string, maxWidth: number, maxLines?: number): FormItem[] {
  const clean = cleanName(value);
  return clean ? [{ page, kind: "text", x, y, text: clean, maxWidth, ...(maxLines ? { maxLines } : {}) }] : [];
}

function check(page: number, wordX: number, y: number, on: boolean): FormItem[] {
  return on ? [{ page, kind: "check", cx: wordX - BOX_OFFSET, y }] : [];
}

function hoursTotal(weekday: string, sunday: string): string {
  const parse = (v: string) => (v.trim() ? Number(v.trim().replace(",", ".")) : 0);
  const total = parse(weekday) + parse(sunday);
  if (!Number.isFinite(total) || total <= 0) return "";
  return `${String(Math.round(total * 100) / 100).replace(".", ",")} h`;
}

function hours(value: string): string {
  return value.trim() ? `${value.trim()} h` : "";
}

function personName(record: AdmissionRecord): string {
  return [cleanName(record.identity.firstName), upper(record.identity.usedName || record.identity.birthName)].filter(Boolean).join(" ");
}

function contactName(record: AdmissionRecord): string {
  const c = record.contact;
  return c ? [cleanName(c.firstName), upper(c.lastName)].filter(Boolean).join(" ") : "";
}

// Page 1 — identité et aide.
function identityItems(r: AdmissionRecord): FormItem[] {
  const id = r.identity;
  const birth = id.birthDate ? frenchDay(id.birthDate).replace(/\//g, "") : "";
  return [
    ...text(0, 124, 268.5, upper(id.birthName), 172),
    ...text(0, 344, 268.5, id.firstName, 190),
    ...text(0, 117, 240.3, upper(id.usedName), 172),
    ...slots(birth, BIRTH_DATE_SLOTS, 0, 241.3),
    ...text(0, 81, 211.8, id.address, 455),
    ...slots(id.postalCode.replace(/\D/g, ""), POSTAL_SLOTS, 0, 184.3),
    ...text(0, 243, 183.3, id.city, 290),
    ...text(0, 140, 154.9, id.phone, 140),
    ...text(0, 354, 154.9, id.email, 185),
    ...check(0, 46.7, 97.8, r.aid.kinds.includes("APA")),
    ...check(0, 259.2, 97.8, r.aid.kinds.includes("PCH")),
    ...check(0, 482.0, 97.8, r.aid.kinds.includes("AIDE_MENAGERE")),
  ];
}

// Page 2 — le SAD désigné (la structure) et le proche à contacter.
function serviceAndContactItems(r: AdmissionRecord, structure: DepartementFormInput["structure"]): FormItem[] {
  const c = r.contact;
  const apa = r.aid.kinds.includes("APA");
  return [
    ...text(1, 118, 681.6, structure.name, 155, 2),
    ...text(1, 131, 643.9, structure.address, 142, 3),
    ...text(1, 284, 655, r.aid.startDate ? frenchDay(r.aid.startDate) : "", 88),
    ...text(1, 382, 662.6, hoursTotal(r.aid.weekdayHours, r.aid.sundayHours), 165),
    // « Pour l'APA, préciser » : semaine et dimanche ne s'écrivent que pour l'APA.
    ...(apa ? [...text(1, 424, 612.6, hours(r.aid.weekdayHours), 120), ...text(1, 431, 580.4, hours(r.aid.sundayHours), 115)] : []),
    ...(c?.kind
      ? [
          ...check(1, 46.7, 368.5, c.kind === "PROCHE_AIDANT"),
          ...check(1, 162.1, 368.5, c.kind === "TUTEUR"),
          ...check(1, 246.4, 368.5, c.kind === "CURATEUR"),
          ...check(1, 345.8, 368.5, c.kind === "AUTRE"),
          ...(c.kind === "AUTRE" ? text(1, 380, 371, c.otherPrecision, 155) : []),
          ...text(1, 66, 342.5, upper(c.lastName), 240),
          ...text(1, 354, 342.5, c.firstName, 185),
          ...text(1, 80, 314.1, c.address, 460),
          ...slots(c.postalCode.replace(/\D/g, ""), POSTAL_SLOTS, 1, 286.6),
          ...text(1, 324, 285.6, c.city, 220),
          ...text(1, 140, 255.8, c.phone, 145),
          ...text(1, 359, 255.8, c.email, 185),
        ]
      : []),
  ];
}

// Page 3 — la déclaration sur l'honneur. Sous TUTELLE, c'est le tuteur qui signe
// « en qualité de représentant légal de » la personne ; sinon la personne signe en
// son nom propre (sous curatelle, assistée : elle signe elle-même).
function declarationItems(input: DepartementFormInput): FormItem[] {
  const r = input.record;
  const byTutor = r.contact?.kind === "TUTEUR";
  const civility = r.identity.civility;
  return [
    ...(byTutor
      ? [
          ...text(2, 174, 736.7, contactName(r), 315),
          ...check(2, 83.1, 704.2, true),
          ...check(2, 263.2, 704.2, civility === "MADAME"),
          ...check(2, 300.5, 704.2, civility === "MONSIEUR"),
          ...text(2, 318, 706.7, personName(r), 185),
        ]
      : [
          ...check(2, 120.0, 734.2, civility === "MADAME"),
          ...check(2, 157.2, 734.2, civility === "MONSIEUR"),
          ...text(2, 174, 736.7, personName(r), 315),
          ...check(2, 83.1, 717.7, true),
        ]),
    ...check(2, 47.6, 684.6, input.certifies),
    ...check(2, 47.6, 652.4, input.acceptsTransmission),
    ...text(2, 68, 598.3, frenchDay(dayOf(input.signedOn)), 150),
    // À droite du libellé, entre le bas du cadre (y ≈ 552) et la ligne « Date ».
    ...(input.withSignature ? [{ page: 2, kind: "image" as const, x: 302, y: 556, maxWidth: 230, maxHeight: 36 }] : []),
  ];
}

export function planDepartementForm(input: DepartementFormInput): FormItem[] {
  return [...identityItems(input.record), ...serviceAndContactItems(input.record, input.structure), ...declarationItems(input)];
}

// Ce qui manque au formulaire, dit avant de le fabriquer (rien n'est bloquant :
// une case vide se complète à la main, mais on le sait).
export function departementFormGaps(record: AdmissionRecord): string[] {
  const id = record.identity;
  return [
    ...(id.birthDate ? [] : ["la date de naissance"]),
    ...(id.address && id.postalCode && id.city ? [] : ["l'adresse complète"]),
    ...(record.aid.kinds.length > 0 ? [] : ["l'aide (APA, PCH ou aide-ménagère)"]),
    ...(record.aid.startDate ? [] : ["la date de début d'intervention"]),
    ...(record.aid.weekdayHours || record.aid.sundayHours ? [] : ["le nombre d'heures"]),
    ...(record.contact?.kind ? [] : ["le proche à contacter"]),
  ];
}

export function departementFormFileName(structureName: string, record: AdmissionRecord, today: Date): string {
  const slug = (v: string, max: number) =>
    v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, max) || "X";
  const person = slug(`${record.identity.usedName || record.identity.birthName} ${record.identity.firstName}`, 50);
  return `${dayOf(today).replace(/-/g, "")}_DESIGNATION-SAD_${slug(structureName, 40)}_${person}_v01_Externe.pdf`;
}
