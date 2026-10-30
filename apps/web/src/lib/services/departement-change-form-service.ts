import { frenchDay, type AdmissionRecord } from "./admission-service";
import { box, contactName, hours, personName, slots, stamp, text, upper, type FormItem } from "./departement-form-service";
import { cleanName, dayOf } from "./survey-roster-service";

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRE DU DÉPARTEMENT (93) — « désignation du SAAD, CHANGEMENT DE SITUATION »
// (27/10/2026). Service PUR. Même principe que la déclaration initiale
// (departement-form-service) : écriture par-dessus le PDF officiel, à des positions
// mesurées sur CE fichier (pdfplumber, 27/10), empreinte figée.
//
// Il sert quand la personne est déjà accompagnée et que quelque chose change :
// arrêt d'un service, nouveau service (à la place ou en complément), ou nombre
// d'heures. Ici, les cases sont des glyphes que le PDF expose : leur centre est
// mesuré directement, sans décalage estimé.
// ─────────────────────────────────────────────────────────────────────────────

export const CHANGE_FORM = {
  path: "/formulaires/93-designation-saad-changement-situation-v1.pdf",
  sha256: "1fb7ff6fae24b7add78cfa59b8ccf3702cabc188fab42a818381c46b1b5c476c",
  title: "Désignation du service d'aide à domicile — changement de situation (Département 93)",
} as const;

export const MAX_STOPPED_SERVICES = 2;
export const MAX_ACTIVE_SERVICES = 4;

export type StoppedService = { name: string; address: string; endDate: string };
export type ActiveService = { name: string; address: string; date: string; weekdayHours: string; sundayHours: string };
export type NewServiceMode = "" | "A_LA_PLACE" | "EN_COMPLEMENT";

export type ChangeFormInput = {
  record: AdmissionRecord;
  stopped: readonly StoppedService[];
  newService: NewServiceMode;
  hoursChange: boolean;
  services: readonly ActiveService[];
  // Gestes de la personne, jamais présumés.
  certifies: boolean;
  replacesPrevious: boolean;
  acceptsTransmission: boolean;
  signedOn: Date;
  withSignature: boolean;
  // Le tampon de la structure dans SA ligne du tableau des services (30/10/2026).
  withStamp: boolean;
  structureName: string;
};

// Positions mesurées (x de début des « _ », centres des cases).
const BIRTH_DATE_SLOTS = [414.2, 426.5, 450.9, 463.2, 487.7, 500.0, 512.2, 524.4];
const POSTAL_SLOTS = [119.3, 131.5, 143.8, 155.9, 168.3];
const LEFT_BOX = 39.3;
const INDENTED_BOX = 81.9;
// Tableau « services intervenant au domicile », page 2 : une rangée par SAAD.
const ACTIVE_ROWS = [
  { name: 314.9, address: 296.1, date: 305, weekday: 305.5, sunday: 286.7 },
  { name: 252.2, address: 233.2, date: 242, weekday: 242.6, sunday: 224 },
  { name: 189.3, address: 170.5, date: 179, weekday: 179.7, sunday: 161.1 },
  { name: 126.4, address: 107.6, date: 116, weekday: 116.9, sunday: 98.2 },
];
// Tableau « arrêt des interventions », page 2.
const STOPPED_ROWS = [
  { name: 629.7, address: 610.9, date: 620 },
  { name: 566.8, address: 548.0, date: 557 },
];

function day(value: string): string {
  return value ? frenchDay(value) : "";
}

function hoursOnly(value: string): string {
  return hours(value).replace(/ h$/, "");
}

// Page 1 — identité et aide (même contenu que la déclaration initiale, autres positions).
function identityItems(r: AdmissionRecord): FormItem[] {
  const id = r.identity;
  return [
    ...text(0, 137, 272.6, upper(id.birthName), 175),
    ...text(0, 359, 272.6, id.firstName, 185),
    ...text(0, 124, 243.9, upper(id.usedName), 180),
    ...slots(day(id.birthDate).replace(/\//g, ""), BIRTH_DATE_SLOTS, 0, 244.9),
    ...text(0, 86, 215.3, id.address, 455),
    ...slots(id.postalCode.replace(/\D/g, ""), POSTAL_SLOTS, 0, 187.8),
    ...text(0, 342, 186.8, id.city, 200),
    ...text(0, 152, 158.1, id.phone, 150),
    ...text(0, 383, 158.1, id.email, 165),
    ...box(0, LEFT_BOX, 101.5, r.aid.kinds.includes("APA")),
    ...box(0, 250.3, 101.5, r.aid.kinds.includes("PCH")),
    ...box(0, 470.0, 101.5, r.aid.kinds.includes("AIDE_MENAGERE")),
  ];
}

// Page 2 — ce qui change, et les tableaux.
function changeItems(input: ChangeFormInput): FormItem[] {
  const stopped = input.stopped.filter((s) => cleanName(s.name)).slice(0, MAX_STOPPED_SERVICES);
  const services = input.services.filter((s) => cleanName(s.name)).slice(0, MAX_ACTIVE_SERVICES);
  return [
    ...box(1, LEFT_BOX, 708.2, stopped.length > 0),
    ...stopped.flatMap((s, i) => [
      ...text(1, 134, STOPPED_ROWS[i]!.name, s.name, 285),
      ...text(1, 151, STOPPED_ROWS[i]!.address, s.address, 270, 2),
      ...text(1, 430, STOPPED_ROWS[i]!.date, day(s.endDate), 120),
    ]),
    ...box(1, LEFT_BOX, 490.9, input.newService !== ""),
    ...box(1, INDENTED_BOX, 471.5, input.newService === "A_LA_PLACE"),
    ...box(1, INDENTED_BOX, 451.9, input.newService === "EN_COMPLEMENT"),
    ...box(1, LEFT_BOX, 432.5, input.hoursChange),
    ...services.flatMap((s, i) => {
      // Le tampon va dans la ligne de LA structure (30/10/2026), à droite de l'adresse,
      // qui se resserre pour lui laisser la place (bas de la rangée : adresse − 27,4).
      const stamped = input.withStamp && sameService(s.name, input.structureName);
      return [
      ...text(1, 119, ACTIVE_ROWS[i]!.name, s.name, 205),
      ...text(1, 136, ACTIVE_ROWS[i]!.address, s.address, stamped ? 100 : 188, 2),
      ...stamp(1, 240, ACTIVE_ROWS[i]!.address - 25.4, 86, 40, stamped),
      ...text(1, 334, ACTIVE_ROWS[i]!.date, day(s.date), 115),
      ...text(1, 526, ACTIVE_ROWS[i]!.weekday, hoursOnly(s.weekdayHours), 30),
      ...text(1, 531, ACTIVE_ROWS[i]!.sunday, hoursOnly(s.sundayHours), 26),
      ];
    }),
  ];
}

function sameService(a: string, b: string): boolean {
  const key = (v: string) => cleanName(v).toLocaleLowerCase("fr-FR");
  return key(a) !== "" && key(a) === key(b);
}

// Page 3 — le proche, puis la déclaration (trois engagements, dont « annule et remplace »).
function contactAndDeclarationItems(input: ChangeFormInput): FormItem[] {
  const r = input.record;
  const c = r.contact;
  const byTutor = c?.kind === "TUTEUR";
  const civility = r.identity.civility;
  return [
    ...(c?.kind
      ? [
          ...box(2, LEFT_BOX, 736.9, c.kind === "PROCHE_AIDANT"),
          ...box(2, 168.9, 736.9, c.kind === "TUTEUR"),
          ...box(2, 259.4, 736.9, c.kind === "CURATEUR"),
          ...box(2, 366.8, 736.9, c.kind === "AUTRE"),
          ...(c.kind === "AUTRE" ? text(2, 410, 739.4, c.otherPrecision, 140) : []),
          ...text(2, 69, 710.9, upper(c.lastName), 240),
          ...text(2, 366, 710.9, c.firstName, 185),
          ...text(2, 86, 682.4, c.address, 465),
          ...slots(c.postalCode.replace(/\D/g, ""), POSTAL_SLOTS, 2, 654.8),
          ...text(2, 349, 653.8, c.city, 200),
          ...text(2, 152, 625.1, c.phone, 155),
          ...text(2, 390, 625.1, c.email, 160),
        ]
      : []),
    ...(byTutor
      ? [
          ...text(2, 182, 545.4, contactName(r), 355),
          ...box(2, 74.7, 512.9, true),
          ...box(2, 275.4, 512.9, civility === "MADAME"),
          ...box(2, 312.3, 512.9, civility === "MONSIEUR"),
          ...text(2, 334, 515.4, personName(r), 210),
        ]
      : [
          ...box(2, 123.2, 542.9, civility === "MADAME"),
          ...box(2, 160.3, 542.9, civility === "MONSIEUR"),
          ...text(2, 182, 545.4, personName(r), 355),
          ...box(2, 74.7, 526.3, true),
        ]),
    ...box(2, LEFT_BOX, 493.4, input.certifies),
    ...box(2, LEFT_BOX, 448.1, input.replacesPrevious),
    ...box(2, LEFT_BOX, 415.4, input.acceptsTransmission),
    ...text(2, 70, 376.9, frenchDay(dayOf(input.signedOn)), 150),
    // À droite de « Signature du bénéficiaire ou de son représentant légal », DANS le
    // cadre (bas du cadre mesuré à y ≈ 315 sur le rendu du 27/10).
    ...(input.withSignature ? [{ page: 2, kind: "image" as const, source: "signature" as const, x: 205, y: 319, maxWidth: 300, maxHeight: 40 }] : []),
  ];
}

export function planChangeForm(input: ChangeFormInput): FormItem[] {
  return [...identityItems(input.record), ...changeItems(input), ...contactAndDeclarationItems(input)];
}

// Ce qui empêche de fabriquer le formulaire : il n'a de sens que si un changement est
// déclaré, et chaque tableau rempli doit dire QUI et QUAND.
export function changeFormProblems(input: Pick<ChangeFormInput, "stopped" | "newService" | "hoursChange" | "services">): string[] {
  const stopped = input.stopped.filter((s) => cleanName(s.name) || s.endDate);
  const services = input.services.filter((s) => cleanName(s.name) || s.date || s.weekdayHours || s.sundayHours);
  const needsServices = input.newService !== "" || input.hoursChange;
  return [
    ...(stopped.length === 0 && !needsServices ? ["Cochez au moins un changement : arrêt d'un service, nouveau service, ou nombre d'heures."] : []),
    ...(stopped.some((s) => !cleanName(s.name) || !s.endDate) ? ["Pour chaque service arrêté, écrivez son nom et la date de fin."] : []),
    ...(needsServices && services.length === 0 ? ["Écrivez les services qui interviennent au domicile, avec la date et les heures."] : []),
    ...(services.some((s) => !cleanName(s.name) || !s.date) ? ["Pour chaque service qui intervient, écrivez son nom et la date de début ou d'effet."] : []),
    ...(stopped.length > MAX_STOPPED_SERVICES ? [`Le formulaire prévoit ${MAX_STOPPED_SERVICES} services arrêtés au plus.`] : []),
    ...(services.length > MAX_ACTIVE_SERVICES ? [`Le formulaire prévoit ${MAX_ACTIVE_SERVICES} services au plus.`] : []),
  ];
}

// La structure en première ligne : c'est elle qui fait remplir le formulaire.
export function defaultActiveServices(record: AdmissionRecord, structure: { name: string; address: string }, today: Date): ActiveService[] {
  return [{ name: structure.name, address: structure.address, date: record.aid.startDate || dayOf(today), weekdayHours: record.aid.weekdayHours, sundayHours: record.aid.sundayHours }];
}

export function changeFormFileName(structureName: string, record: AdmissionRecord, today: Date): string {
  const slug = (v: string, max: number) =>
    v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, max) || "X";
  const person = slug(`${record.identity.usedName || record.identity.birthName} ${record.identity.firstName}`, 50);
  return `${dayOf(today).replace(/-/g, "")}_CHANGEMENT-SITUATION_${slug(structureName, 40)}_${person}_v01_Externe.pdf`;
}
