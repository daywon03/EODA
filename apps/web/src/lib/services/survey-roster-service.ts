// ─────────────────────────────────────────────────────────────────────────────
// LISTE DES PERSONNES À ENQUÊTER — tenue SUR LA TABLETTE, jamais envoyée à EODA
// (décision de Damon du 22/10/2026). Service PUR.
//
// Pourquoi ici et pas en base : nom + prénom d'une personne accompagnée par un SAD
// est une donnée de santé (ADR 20261014, verrou HDS). La liste vit donc seulement
// dans le navigateur de la tablette de la structure — comme sa feuille d'émargement
// papier —, et les RÉPONSES partent anonymes par `submitTabletAnonymousSurvey`.
// Rien ne relie un nom à des réponses : la liste ne garde que la DATE à laquelle
// chaque questionnaire a été fait. Aucun module serveur n'importe ce fichier
// (`survey-roster-boundary.test.ts`).
//
// Import : un export du logiciel métier (Ximi…) ou un fichier tapé à la main. Les
// colonnes « Nom » et « Prénom » sont reconnues où qu'elles soient ; toute autre
// colonne (adresse, GIR…) est ignorée, jamais lue ni gardée.
// Export : « Nom ; Prénom ; enquête personne ; enquête proche », pour le reporter
// dans le logiciel métier. Le format d'import exact de Ximi reste à confirmer sur un
// exemple réel.
// ─────────────────────────────────────────────────────────────────────────────

export type RosterSurveyCode = "PERSONNE" | "FAMILLE";
export const ROSTER_SURVEY_CODES: readonly RosterSurveyCode[] = ["PERSONNE", "FAMILLE"];

export type RosterPerson = {
  id: string;
  lastName: string;
  firstName: string;
  // Jour (AAAA-MM-JJ) où chaque questionnaire a été fait — jamais les réponses.
  done: Partial<Record<RosterSurveyCode, string>>;
};

export type Roster = { version: 1; people: RosterPerson[] };

export const EMPTY_ROSTER: Roster = { version: 1, people: [] };
export const ROSTER_MAX_PEOPLE = 1000;
export const ROSTER_MAX_NAME = 80;

export type RosterImportIssue = { line: number; reason: string };
export type RosterImportPlan = { people: { lastName: string; firstName: string }[]; issues: RosterImportIssue[] };

// ── Noms ─────────────────────────────────────────────────────────────────────

// Retire les caractères de contrôle et les espaces multiples : un nom collé depuis un
// tableur traîne souvent une tabulation ou un retour chariot.
export function cleanName(value: string): string {
  return value
    .replace(/^﻿/, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Clé de comparaison : sans accents ni casse (« Lefèvre » = « LEFEVRE »).
export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr-FR")
    .trim();
}

function personKey(lastName: string, firstName: string): string {
  return `${foldName(lastName)}|${foldName(firstName)}`;
}

export function displayName(person: Pick<RosterPerson, "lastName" | "firstName">): string {
  return [person.lastName.toLocaleUpperCase("fr-FR"), person.firstName].filter(Boolean).join(" ");
}

// ── Lecture d'un tableau (CSV, collage depuis Excel, ou lignes d'un .xlsx) ──────

// Sépare une ligne CSV en respectant les guillemets (« "Dupont; Jean" » reste une
// seule cellule) — un export de logiciel métier en contient.
export function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === separator) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

// Le séparateur le plus fréquent de la première ligne non vide : tabulation (collage
// depuis Excel), « ; » (export français) ou « , ».
export function detectSeparator(text: string): string {
  const first = text.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  const counts = ["\t", ";", ","].map((sep) => ({ sep, n: first.split(sep).length - 1 }));
  const best = counts.reduce((a, b) => (b.n > a.n ? b : a));
  return best.n > 0 ? best.sep : ";";
}

export function parseDelimitedText(text: string): string[][] {
  const separator = detectSeparator(text);
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => splitCsvLine(line, separator));
}

// ── Colonnes ─────────────────────────────────────────────────────────────────

const LAST_NAME_HEADERS = ["nom", "nom de famille", "nom usage", "nom d'usage", "nom usuel", "nom beneficiaire", "nom du beneficiaire", "nom client", "nom usager", "last name", "lastname"];
const FIRST_NAME_HEADERS = ["prenom", "prenom beneficiaire", "prenom du beneficiaire", "prenom client", "prenom usager", "first name", "firstname"];
const FULL_NAME_HEADERS = ["nom prenom", "nom et prenom", "nom complet", "beneficiaire", "usager", "client", "personne"];

function headerKey(cell: string): string {
  return foldName(cleanName(cell)).replace(/[_\-./]+/g, " ").replace(/\s+/g, " ").trim();
}

export type RosterColumns =
  | { kind: "SPLIT"; lastName: number; firstName: number; headerRow: boolean }
  | { kind: "FULL"; fullName: number; headerRow: boolean };

// Repère les colonnes. Avec en-tête : « Nom » / « Prénom » où qu'ils soient (un export
// Ximi a vingt colonnes). Sans en-tête : 1re colonne = nom, 2e = prénom ; une seule
// colonne = « NOM Prénom » d'un bloc.
export function detectRosterColumns(firstRow: readonly string[]): RosterColumns {
  const keys = firstRow.map(headerKey);
  const lastName = keys.findIndex((k) => LAST_NAME_HEADERS.includes(k));
  const firstName = keys.findIndex((k) => FIRST_NAME_HEADERS.includes(k));
  if (lastName >= 0 && firstName >= 0) return { kind: "SPLIT", lastName, firstName, headerRow: true };
  const fullName = keys.findIndex((k) => FULL_NAME_HEADERS.includes(k));
  if (fullName >= 0) return { kind: "FULL", fullName, headerRow: true };
  if (lastName >= 0) return { kind: "FULL", fullName: lastName, headerRow: true };
  const filled = firstRow.filter((cell) => cleanName(cell) !== "").length;
  return filled >= 2 ? { kind: "SPLIT", lastName: 0, firstName: 1, headerRow: false } : { kind: "FULL", fullName: 0, headerRow: false };
}

// « DUPONT Marie » → nom DUPONT, prénom Marie : les mots en capitales en tête sont le
// nom. Sans capitales, tout le texte devient le nom — on ne devine pas une coupure.
// « DUPONT, Marie » (export « Clients » de Ximi, colonne « Nom » seule, mesuré le
// 26/10/2026) : la virgule EST la coupure, quelle que soit la casse.
export function splitFullName(value: string): { lastName: string; firstName: string } {
  const comma = cleanName(value).match(/^([^,]+),\s*(.+)$/);
  if (comma) return { lastName: cleanName(comma[1]!), firstName: cleanName(comma[2]!) };
  const words = cleanName(value).split(" ").filter(Boolean);
  const isUpper = (w: string) => /\p{L}/u.test(w) && w === w.toLocaleUpperCase("fr-FR") && w.length > 1;
  let cut = 0;
  while (cut < words.length && isUpper(words[cut]!)) cut += 1;
  if (cut === 0 || cut === words.length) return { lastName: words.join(" "), firstName: "" };
  return { lastName: words.slice(0, cut).join(" "), firstName: words.slice(cut).join(" ") };
}

// ── Plan d'import ────────────────────────────────────────────────────────────

// Un export de logiciel métier peut précéder son tableau d'une ligne de titre
// (Ximi : « Client (Clients (Générale)) - date - nom de qui a exporté », puis une
// ligne vide, puis les en-têtes en ligne 3 — mesuré le 26/10/2026). On cherche donc
// la ligne d'en-tête parmi les premières lignes ; sans en-tête reconnu, la première
// ligne non vide est déjà une personne.
const HEADER_SEARCH_ROWS = 10;

function locateTable(rows: readonly (readonly string[])[]): { start: number; columns: RosterColumns } | null {
  const filled = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.some((cell) => cleanName(cell) !== ""));
  if (filled.length === 0) return null;
  for (const { row, index } of filled.slice(0, HEADER_SEARCH_ROWS)) {
    const columns = detectRosterColumns(row);
    if (columns.headerRow) return { start: index + 1, columns };
  }
  return { start: filled[0]!.index, columns: detectRosterColumns(filled[0]!.row) };
}

export function planRosterImport(rows: readonly (readonly string[])[], existing: readonly RosterPerson[] = []): RosterImportPlan {
  const people: RosterImportPlan["people"] = [];
  const issues: RosterImportIssue[] = [];
  const table = locateTable(rows);
  if (!table) return { people, issues };
  const { columns } = table;
  const seen = new Set(existing.map((p) => personKey(p.lastName, p.firstName)));
  let capacity = ROSTER_MAX_PEOPLE - existing.length;

  for (let index = table.start; index < rows.length; index += 1) {
    const row = rows[index]!;
    const line = index + 1;
    if (row.every((cell) => cleanName(cell) === "")) continue;
    const name =
      columns.kind === "SPLIT"
        ? { lastName: cleanName(row[columns.lastName] ?? ""), firstName: cleanName(row[columns.firstName] ?? "") }
        : splitFullName(row[columns.fullName] ?? "");
    if (!name.lastName && !name.firstName) {
      issues.push({ line, reason: "nom manquant" });
      continue;
    }
    if (name.lastName.length > ROSTER_MAX_NAME || name.firstName.length > ROSTER_MAX_NAME) {
      issues.push({ line, reason: "nom trop long" });
      continue;
    }
    const key = personKey(name.lastName, name.firstName);
    if (seen.has(key)) {
      issues.push({ line, reason: "déjà dans la liste" });
      continue;
    }
    if (capacity <= 0) {
      issues.push({ line, reason: "liste pleine" });
      break;
    }
    seen.add(key);
    capacity -= 1;
    people.push({ lastName: name.lastName || name.firstName, firstName: name.lastName ? name.firstName : "" });
  }
  return { people, issues };
}

export function describeRosterImport(plan: RosterImportPlan): string {
  const n = plan.people.length;
  const head = n === 0 ? "Aucune personne ajoutée." : `${n} personne${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""}.`;
  if (plan.issues.length === 0) return head;
  const detail = plan.issues
    .slice(0, 4)
    .map((issue) => `ligne ${issue.line} : ${issue.reason}`)
    .join(" ; ");
  const m = plan.issues.length;
  return `${head} ${m} ligne${m > 1 ? "s" : ""} non prise${m > 1 ? "s" : ""} (${detail}${m > 4 ? "…" : ""}).`;
}

// ── Modifications de la liste (toujours une nouvelle valeur) ────────────────

export function addPeople(roster: Roster, people: RosterImportPlan["people"], newId: () => string): Roster {
  const added = people.map((p) => ({ id: newId(), lastName: p.lastName, firstName: p.firstName, done: {} }));
  return { version: 1, people: sortPeople([...roster.people, ...added]) };
}

// Saisie à la main d'une personne : même contrôle que l'import.
export function addPersonError(roster: Roster, lastName: string, firstName: string): string | null {
  const last = cleanName(lastName);
  const first = cleanName(firstName);
  if (!last) return "Écrivez le nom.";
  if (last.length > ROSTER_MAX_NAME || first.length > ROSTER_MAX_NAME) return "Le nom est trop long.";
  if (roster.people.length >= ROSTER_MAX_PEOPLE) return "La liste est pleine.";
  if (roster.people.some((p) => personKey(p.lastName, p.firstName) === personKey(last, first))) return "Cette personne est déjà dans la liste.";
  return null;
}

export function removePerson(roster: Roster, personId: string): Roster {
  return { version: 1, people: roster.people.filter((p) => p.id !== personId) };
}

export function markSurveyDone(roster: Roster, personId: string, code: RosterSurveyCode, day: string): Roster {
  return {
    version: 1,
    people: roster.people.map((p) => (p.id === personId ? { ...p, done: { ...p.done, [code]: day } } : p)),
  };
}

export function sortPeople(people: readonly RosterPerson[]): RosterPerson[] {
  return [...people].sort(
    (a, b) => a.lastName.localeCompare(b.lastName, "fr", { sensitivity: "base" }) || a.firstName.localeCompare(b.firstName, "fr", { sensitivity: "base" })
  );
}

// ── Lecture ──────────────────────────────────────────────────────────────────

export function searchRoster(roster: Roster, query: string): RosterPerson[] {
  const words = foldName(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return roster.people;
  return roster.people.filter((p) => {
    const haystack = foldName(`${p.lastName} ${p.firstName}`);
    return words.every((w) => haystack.includes(w));
  });
}

// La personne elle-même compte : « fait » = son questionnaire à elle est rempli. Le
// questionnaire des proches est un plus, suivi à part.
export function isPersonDone(person: RosterPerson): boolean {
  return Boolean(person.done.PERSONNE);
}

export function nextToSurvey(roster: Roster): RosterPerson | null {
  return roster.people.find((p) => !isPersonDone(p)) ?? null;
}

export function rosterProgress(roster: Roster): { total: number; done: number; families: number } {
  return {
    total: roster.people.length,
    done: roster.people.filter(isPersonDone).length,
    families: roster.people.filter((p) => Boolean(p.done.FAMILLE)).length,
  };
}

// ── Stockage (le navigateur peut rendre n'importe quoi : lecture défensive) ──

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseStoredRoster(raw: string | null): Roster {
  if (!raw) return EMPTY_ROSTER;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return EMPTY_ROSTER;
  }
  if (typeof data !== "object" || data === null || (data as { version?: unknown }).version !== 1) return EMPTY_ROSTER;
  const list = (data as { people?: unknown }).people;
  if (!Array.isArray(list)) return EMPTY_ROSTER;
  const people: RosterPerson[] = [];
  for (const item of list.slice(0, ROSTER_MAX_PEOPLE)) {
    if (typeof item !== "object" || item === null) continue;
    const { id, lastName, firstName, done } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof lastName !== "string" || typeof firstName !== "string") continue;
    const safeDone: RosterPerson["done"] = {};
    if (typeof done === "object" && done !== null) {
      for (const code of ROSTER_SURVEY_CODES) {
        const day = (done as Record<string, unknown>)[code];
        if (typeof day === "string" && DAY.test(day)) safeDone[code] = day;
      }
    }
    people.push({ id, lastName: cleanName(lastName).slice(0, ROSTER_MAX_NAME), firstName: cleanName(firstName).slice(0, ROSTER_MAX_NAME), done: safeDone });
  }
  return { version: 1, people: sortPeople(people) };
}

// La clé dit la structure : une tablette ré-enregistrée pour une autre structure ne
// montre jamais la liste de la précédente.
export function rosterStorageKey(establishmentId: string): string {
  return `eoda.tablette.enquete.liste.v1.${establishmentId}`;
}

// Jour local de la tablette (AAAA-MM-JJ) — l'heure ne sert à rien et n'est pas gardée.
export function dayOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ── Export pour le logiciel métier ───────────────────────────────────────────

function frenchDay(day: string | undefined): string {
  if (!day) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

// Une cellule qui commence par = + - @ serait lue comme une formule par Excel
// (injection de formule) : on la neutralise.
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const ROSTER_EXPORT_HEADER = ["Nom", "Prénom", "Enquête personne faite le", "Enquête proche faite le"] as const;

// CSV « ; » avec BOM UTF-8 : s'ouvre tel quel dans Excel français et s'importe dans
// un logiciel métier.
export function buildRosterCsv(roster: Roster): string {
  const lines = [ROSTER_EXPORT_HEADER.join(";")];
  for (const p of roster.people) {
    lines.push([p.lastName, p.firstName, frenchDay(p.done.PERSONNE), frenchDay(p.done.FAMILLE)].map(csvCell).join(";"));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function rosterExportFileName(structureName: string, today: Date): string {
  const slug = structureName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "Structure";
  return `${dayOf(today).replace(/-/g, "")}_ENQUETE_${slug}_Suivi-participation_v01_Interne.csv`;
}

export const ROSTER_TEMPLATE_CSV = "﻿Nom;Prénom\r\nDUPONT;Marie\r\nMARTIN;Jean\r\n";
