// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DE LA PREMIÈRE FEUILLE D'UN .xlsx DANS LE NAVIGATEUR — sans dépendance.
//
// Sert à l'import de la liste des personnes sur la tablette (survey-roster-service) :
// le fichier exporté du logiciel métier ne doit JAMAIS partir vers le serveur (noms de
// personnes accompagnées, verrou HDS), donc il se lit ici. exceljs pèse ~1 Mo dans un
// paquet client ; un .xlsx n'est qu'un zip de XML, et le navigateur sait inflater
// (`DecompressionStream("deflate-raw")`).
//
// Le fichier est hostile : tailles bornées (fichier, entrée décompressée, lignes,
// colonnes), lecture du texte des cellules seulement — aucune formule évaluée, aucun
// lien suivi.
// ─────────────────────────────────────────────────────────────────────────────

export const XLSX_MAX_FILE_BYTES = 5_000_000;
const MAX_ENTRY_BYTES = 30_000_000;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 60;

export class XlsxReadError extends Error {}

type ZipEntry = { name: string; method: number; compressedSize: number; offset: number };

function u16(b: Uint8Array, i: number): number {
  return b[i]! | (b[i + 1]! << 8);
}
function u32(b: Uint8Array, i: number): number {
  return (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
}

function listEntries(bytes: Uint8Array): ZipEntry[] {
  // Fin du répertoire central : cherchée depuis la fin (commentaire ≤ 65 535 octets).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i -= 1) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new XlsxReadError("Ce fichier n'est pas un fichier Excel (.xlsx).");
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n += 1) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new XlsxReadError("Fichier Excel abîmé.");
    const nameLength = u16(bytes, p + 28);
    const extraLength = u16(bytes, p + 30);
    const commentLength = u16(bytes, p + 32);
    entries.push({
      method: u16(bytes, p + 10),
      compressedSize: u32(bytes, p + 20),
      offset: u32(bytes, p + 42),
      name: decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength)),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    // Bombe de décompression : on s'arrête avant d'avoir tout produit.
    if (total > MAX_ENTRY_BYTES) {
      await reader.cancel();
      throw new XlsxReadError("Fichier Excel trop gros.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const p = entry.offset;
  if (p + 30 > bytes.length || u32(bytes, p) !== 0x04034b50) throw new XlsxReadError("Fichier Excel abîmé.");
  const start = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method === 8) return new TextDecoder().decode(await inflate(data));
  throw new XlsxReadError("Compression du fichier Excel non prise en charge.");
}

export function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// Texte d'un <si> ou d'un <is> : concaténation de ses <t> (texte enrichi compris),
// en ignorant les annotations phonétiques <rPh>.
function runsText(xml: string): string {
  const withoutPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let text = "";
  for (const match of withoutPhonetic.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) text += decodeXml(match[1] ?? "");
  return text;
}

// Un classeur écrit par le SDK OpenXML de Microsoft préfixe ses balises
// (`<x:row>`, `<x:c>`, `<x:si>`) — c'est le cas de l'export « Clients » de Ximi
// (mesuré le 26/10/2026 : sans ceci, ZÉRO ligne lue). On retire le préfixe des NOMS
// de balise seulement ; les attributs (`r:id`) restent tels quels.
export function withoutTagPrefixes(xml: string): string {
  return xml.replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, "<$1");
}

export function parseSharedStrings(xml: string): string[] {
  return Array.from(withoutTagPrefixes(xml).matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g), (m) => runsText(m[1] ?? ""));
}

// « BC12 » → 54 (index de colonne, 0 = A).
export function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "";
  let n = 0;
  for (const letter of letters) n = n * 26 + (letter.charCodeAt(0) - 64);
  return n - 1;
}

export function parseSheetRows(xml: string, shared: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of withoutTagPrefixes(xml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    if (rows.length >= MAX_ROWS) break;
    const row: string[] = [];
    for (const cell of rowMatch[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? "";
      const body = cell[2] ?? "";
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : row.length;
      if (col < 0 || col >= MAX_COLUMNS) continue;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = runsText(/<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? "");
      else if (raw !== undefined) value = decodeXml(raw);
      while (row.length < col) row.push("");
      row[col] = value;
    }
    rows.push(row);
  }
  return rows;
}

// Première feuille selon le classeur (workbook.xml → relation), sinon sheet1.xml.
async function firstSheetPath(bytes: Uint8Array, entries: ZipEntry[]): Promise<string> {
  const find = (name: string) => entries.find((e) => e.name === name);
  const workbook = find("xl/workbook.xml");
  const rels = find("xl/_rels/workbook.xml.rels");
  if (workbook && rels) {
    const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(withoutTagPrefixes(await readEntry(bytes, workbook)))?.[1];
    if (rid) {
      const relsXml = await readEntry(bytes, rels);
      for (const rel of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        const attrs = rel[1] ?? "";
        if (/\bId="([^"]+)"/.exec(attrs)?.[1] !== rid) continue;
        const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
        if (target) return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      }
    }
  }
  const fallback = entries.map((e) => e.name).filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
  if (!fallback) throw new XlsxReadError("Aucune feuille trouvée dans le fichier Excel.");
  return fallback;
}

export async function readXlsxRows(bytes: Uint8Array): Promise<string[][]> {
  if (bytes.length > XLSX_MAX_FILE_BYTES) throw new XlsxReadError("Fichier trop gros (5 Mo au plus).");
  if (bytes.length < 4 || u32(bytes, 0) !== 0x04034b50) throw new XlsxReadError("Ce fichier n'est pas un fichier Excel (.xlsx).");
  const entries = listEntries(bytes);
  const sheetPath = await firstSheetPath(bytes, entries);
  const sheet = entries.find((e) => e.name === sheetPath);
  if (!sheet) throw new XlsxReadError("Aucune feuille trouvée dans le fichier Excel.");
  const sharedEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const shared = sharedEntry ? parseSharedStrings(await readEntry(bytes, sharedEntry)) : [];
  return parseSheetRows(await readEntry(bytes, sheet), shared);
}
