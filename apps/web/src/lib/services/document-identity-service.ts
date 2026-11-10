// ─────────────────────────────────────────────────────────────────────────────
// VERSION ET DATE ÉCRITES PAR LA PLATEFORME (E3, call du 09/11/2026) — règles pures.
//
// Sandrine, sur la mise en conformité de la FAMO : « la version proposée affiche
// 11/10/2026 au lieu d'aujourd'hui, et la version devrait passer en 1.1 ». L'IA ne
// touche JAMAIS une version ni une date (cahier de style + `sanitizeProposal`,
// correction-proposal.test.ts) : c'est la PLATEFORME qui les écrit, de façon
// déterministe, à l'enregistrement de la version N+1 (`applyCorrectionProposal`).
//
// Ce qui est réécrit : le BLOC D'IDENTIFICATION du document, repéré par ses libellés
// (« Version », « Date de mise à jour », « Dernière mise à jour », « Mise à jour le »)
// dans les premières lignes seulement. Le corps n'est jamais touché : une « version 3
// du logiciel » ou une loi du 02/01/2002 citée plus bas restent ce qu'elles sont. La
// date de création et la date de prochaine révision ne sont pas des dates de mise à
// jour : elles ne bougent pas.
//
// Règle d'incrément (écrite ici, testée) : un numéro sans point prend « .1 »
// (1 → 1.1, V2 → V2.1) ; sinon le DERNIER nombre augmente de 1 (1.1 → 1.2, 1.9 → 1.10).
// La date du jour se lit à PARIS et s'écrit au format que le document utilise déjà.
// ─────────────────────────────────────────────────────────────────────────────

import { DOCUMENT_FOLDER_SEEDS } from "@eoda/database/document-folders";

// Le bloc d'identification se cherche dans ces premières lignes du texte.
const HEADER_ZONE_LINES = 40;
// Au-delà, une ligne est une phrase, pas un libellé suivi de sa valeur.
const MAX_LABEL_LINE_LENGTH = 120;

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
] as const;
const MONTH_PATTERN = "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre";

const VERSION_VALUE = String.raw`(?:[Vv]\s?)?\d+(?:[.,]\d+)*`;
const PLACEHOLDER = String.raw`\[À compléter[^\]]*\]`;
const DATE_VALUE = [
  String.raw`\d{1,2}([/.-])\d{1,2}\1(?:\d{4}|\d{2})(?!\d)`,
  String.raw`\d{4}-\d{2}-\d{2}`,
  String.raw`(?:\d{1,2}(?:er)?\s+)?(?:${MONTH_PATTERN})\s+\d{4}`,
].join("|");

// Décor Markdown en tête de ligne : titre, citation, puce, gras, barre de tableau.
const LEADING_DECORATION = /^[\s#>*_|-]*/;
const VERSION_LABEL = /^(?:(?:n°|num[ée]ro)\s+de\s+)?version\b/i;
const DATE_LABEL =
  /^(?:date\s+de\s+(?:la\s+)?(?:derni[èe]re\s+)?(?:mise\s+à\s+jour|version|modification)|derni[èe]re\s+mise\s+à\s+jour|mise?\s+à\s+jour(?:\s+le)?)\b/i;
// Entre un libellé et sa valeur : deux-points, gras, barres, tirets, espaces.
const SEPARATORS = /^[\s:*_|–—-]*/;

export type StampOptions = {
  // Version que la plateforme connaît pour la version source, quand le document n'en
  // écrit aucune (le numéro de dépôt, « 1 » pour un premier dépôt).
  previousVersionLabel: string;
  today: Date;
};

export type StampedIdentity = {
  text: string;
  version: string;
  date: string;
  // true : aucun bloc trouvé, une ligne normalisée a été ajoutée en tête.
  added: boolean;
};

export function nextDocumentVersion(previous: string): string {
  const match = new RegExp(`^(${VERSION_VALUE})$`).exec(previous.trim());
  if (!match) return "1.1";
  const value = match[1]!;
  const lastNumber = /(\d+)$/.exec(value)!;
  if (!/[.,]/.test(value)) return `${value}.1`;
  const start = value.length - lastNumber[1]!.length;
  return `${value.slice(0, start)}${Number(lastNumber[1]) + 1}`;
}

type ParisDate = { day: number; month: number; year: number };

function parisDate(date: Date): ParisDate {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: read("day"), month: read("month"), year: read("year") };
}

const pad = (n: number) => String(n).padStart(2, "0");

function defaultFormat({ day, month, year }: ParisDate): string {
  return `${pad(day)}/${pad(month)}/${year}`;
}

function monthName(month: number, capitalized: boolean): string {
  const name = MONTHS[month - 1]!;
  return capitalized ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

// La date du jour, écrite comme `sample` l'est (JJ/MM/AAAA, AAAA-MM-JJ, « 10 novembre
// 2026 », « novembre 2026 »…). Un échantillon illisible donne JJ/MM/AAAA.
export function formatLikeSample(sample: string, today: Date): string {
  const date = parisDate(today);
  const trimmed = sample.trim();

  const numeric = /^(\d{1,2})([/.-])(\d{1,2})\2(\d{4}|\d{2})$/.exec(trimmed);
  if (numeric) {
    const padded = numeric[1]!.length === 2 || numeric[3]!.length === 2;
    const day = padded ? pad(date.day) : String(date.day);
    const month = padded ? pad(date.month) : String(date.month);
    const year = numeric[4]!.length === 2 ? String(date.year).slice(-2) : String(date.year);
    return `${day}${numeric[2]}${month}${numeric[2]}${year}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${date.year}-${pad(date.month)}-${pad(date.day)}`;

  const long = new RegExp(`^(\\d{1,2}(?:er)?\\s+)?(${MONTH_PATTERN})\\s+\\d{4}$`, "i").exec(trimmed);
  if (long) {
    const capitalized = /^[A-ZÀ-Ý]/.test(long[2]!);
    const month = `${monthName(date.month, capitalized)} ${date.year}`;
    if (!long[1]) return month;
    return `${date.day === 1 ? "1er" : date.day} ${month}`;
  }
  return defaultFormat(date);
}

type Found = { index: number; length: number; text: string };

function findFirst(segment: string, pattern: string): Found | null {
  const match = new RegExp(pattern, "i").exec(segment);
  return match ? { index: match.index, length: match[0].length, text: match[0] } : null;
}

function replaceAt(line: string, offset: number, found: Found, value: string): string {
  const start = offset + found.index;
  return `${line.slice(0, start)}${value}${line.slice(start + found.length)}`;
}

type LabelLine = { kind: "VERSION" | "DATE"; labelEnd: number };

function readLabel(line: string): LabelLine | null {
  if (line.length > MAX_LABEL_LINE_LENGTH) return null;
  const decoration = LEADING_DECORATION.exec(line)![0].length;
  const rest = line.slice(decoration);
  const version = VERSION_LABEL.exec(rest);
  if (version) return { kind: "VERSION", labelEnd: decoration + version[0].length };
  const date = DATE_LABEL.exec(rest);
  if (date) return { kind: "DATE", labelEnd: decoration + date[0].length };
  return null;
}

// Texte de la ligne sans son décor ni ses séparateurs : sert à reconnaître une
// valeur seule sur sa ligne (cellule de tableau convertie en texte).
function bareValue(line: string): string {
  return line.replace(LEADING_DECORATION, "").replace(/[\s*_|]+$/, "");
}

function nextNonEmpty(lines: readonly string[], from: number): number | null {
  for (let i = from + 1; i < Math.min(lines.length, from + 3); i++) {
    if (lines[i]!.trim().length > 0) return i;
  }
  return null;
}

type Stamp = { version: string | null; date: string | null; versionLine: number | null; dateLine: number | null };

function stampVersionIn(lines: string[], index: number, labelEnd: number, previous: string, stamp: Stamp): void {
  const line = lines[index]!;
  const offset = labelEnd + SEPARATORS.exec(line.slice(labelEnd))![0].length;
  const remainder = line.slice(offset);
  const value = new RegExp(`^(?:${VERSION_VALUE}|${PLACEHOLDER})`).exec(remainder);
  if (value) {
    const next = nextDocumentVersion(/^\[/.test(value[0]) ? previous : value[0]);
    lines[index] = replaceAt(line, offset, { index: 0, length: value[0].length, text: value[0] }, next);
    stamp.version = next;
    stamp.versionLine = index;
    return;
  }
  if (bareValue(remainder).length > 0) return;
  // Libellé seul : la valeur est sur la ligne suivante (cellule de tableau).
  const valueLine = nextNonEmpty(lines, index);
  if (valueLine === null) return;
  const candidate = bareValue(lines[valueLine]!);
  if (!new RegExp(`^(?:${VERSION_VALUE}|${PLACEHOLDER})$`).test(candidate)) return;
  const next = nextDocumentVersion(/^\[/.test(candidate) ? previous : candidate);
  const at = lines[valueLine]!.indexOf(candidate);
  lines[valueLine] = replaceAt(lines[valueLine]!, at, { index: 0, length: candidate.length, text: candidate }, next);
  stamp.version = next;
  stamp.versionLine = valueLine;
}

function stampDateIn(lines: string[], index: number, from: number, today: Date, stamp: Stamp): boolean {
  const line = lines[index]!;
  const remainder = line.slice(from);
  const found = findFirst(remainder, `${DATE_VALUE}|${PLACEHOLDER}`);
  if (found) {
    const value = formatLikeSample(found.text, today);
    lines[index] = replaceAt(line, from, found, value);
    stamp.date = value;
    stamp.dateLine = index;
    return true;
  }
  return false;
}

function stampDateLabel(lines: string[], index: number, labelEnd: number, today: Date, stamp: Stamp): void {
  if (stampDateIn(lines, index, labelEnd, today, stamp)) return;
  const line = lines[index]!;
  const offset = labelEnd + SEPARATORS.exec(line.slice(labelEnd))![0].length;
  const remainder = line.slice(offset);
  // Zone laissée vide pour être remplie à la main : « ……… », « ____ ».
  if (/^[.…_\s]+$/.test(remainder)) {
    const value = defaultFormat(parisDate(today));
    lines[index] = `${line.slice(0, offset)}${value}`;
    stamp.date = value;
    stamp.dateLine = index;
    return;
  }
  if (bareValue(remainder).length > 0) return;
  const valueLine = nextNonEmpty(lines, index);
  if (valueLine === null) return;
  const candidate = bareValue(lines[valueLine]!);
  if (!new RegExp(`^(?:${DATE_VALUE}|${PLACEHOLDER})$`, "i").test(candidate)) return;
  stampDateIn(lines, valueLine, 0, today, stamp);
}

function insertIdentityLine(lines: string[], identity: string): string[] {
  const first = lines.findIndex((l) => l.trim().length > 0);
  if (first === -1) return [identity];
  if (!/^#{1,3}\s/.test(lines[first]!)) return [identity, "", ...lines];
  const after = lines.slice(first + 1);
  const spacer = after.length > 0 && after[0]!.trim().length > 0 ? [""] : [];
  return [...lines.slice(0, first + 1), "", identity, ...spacer, ...after];
}

export function stampDocumentIdentity(text: string, options: StampOptions): StampedIdentity {
  const lines = text.split("\n");
  const stamp: Stamp = { version: null, date: null, versionLine: null, dateLine: null };
  const zone = Math.min(lines.length, HEADER_ZONE_LINES);

  for (let i = 0; i < zone; i++) {
    const label = readLabel(lines[i]!);
    if (!label) continue;
    if (label.kind === "VERSION" && stamp.version === null) {
      stampVersionIn(lines, i, label.labelEnd, options.previousVersionLabel, stamp);
      // « Version 02 — 19 juillet 2026 » : la date est sur la même ligne.
      if (stamp.versionLine === i && stamp.date === null) {
        const afterVersion = lines[i]!.indexOf(stamp.version!, label.labelEnd) + stamp.version!.length;
        stampDateIn(lines, i, afterVersion, options.today, stamp);
      }
    } else if (label.kind === "DATE" && stamp.date === null) {
      stampDateLabel(lines, i, label.labelEnd, options.today, stamp);
    }
  }

  const today = defaultFormat(parisDate(options.today));
  if (stamp.version === null && stamp.date === null) {
    const version = nextDocumentVersion(options.previousVersionLabel);
    const identity = `**Version :** ${version} · **Date de mise à jour :** ${today}`;
    return { text: insertIdentityLine(lines, identity).join("\n"), version, date: today, added: true };
  }
  if (stamp.date === null) {
    // Version trouvée sans date : la date du jour juste en dessous.
    lines.splice(stamp.versionLine! + 1, 0, `Date de mise à jour : ${today}`);
    return { text: lines.join("\n"), version: stamp.version!, date: today, added: false };
  }
  if (stamp.version === null) {
    const version = nextDocumentVersion(options.previousVersionLabel);
    lines.splice(stamp.dateLine!, 0, `Version : ${version}`);
    return { text: lines.join("\n"), version, date: stamp.date, added: false };
  }
  return { text: lines.join("\n"), version: stamp.version, date: stamp.date, added: false };
}

// ── Quels documents reçoivent le bloc d'identification ──────────────────────
//
// Fiche de sensibilisation (professionnels ou personnes accompagnées) : « la date
// d'upload suffit » (Sandrine, 09/11/2026 — règle PROVISOIRE, content/regles-redaction/
// gabarit.ts). Reconnue par son DOSSIER (les deux dossiers « Sensibilisation… » posés
// par la migration du 03/11) ou par une ligne du référentiel rangée d'office dans
// l'un d'eux — une ligne créée par le cabinet dans ces dossiers est une fiche aussi.
const AWARENESS_FOLDER_IDS: readonly string[] = ["docfolder-sensibilisation-pro", "docfolder-sensibilisation-pa"];
const AWARENESS_CODES: ReadonlySet<string> = new Set(
  DOCUMENT_FOLDER_SEEDS.filter((folder) => AWARENESS_FOLDER_IDS.includes(folder.id)).flatMap((folder) => folder.codes)
);

export type DocumentIdentityRule = "PLATFORM_STAMP" | "UPLOAD_DATE";
export type DocumentTypeFacts = { code: string; folderId: string | null };

export function isAwarenessSheetType(type: DocumentTypeFacts): boolean {
  return AWARENESS_CODES.has(type.code) || (type.folderId !== null && AWARENESS_FOLDER_IDS.includes(type.folderId));
}

export function documentIdentityRule(type: DocumentTypeFacts): DocumentIdentityRule {
  return isAwarenessSheetType(type) ? "UPLOAD_DATE" : "PLATFORM_STAMP";
}
