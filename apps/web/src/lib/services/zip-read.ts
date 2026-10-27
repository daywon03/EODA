// ─────────────────────────────────────────────────────────────────────────────
// LECTURE D'UNE ARCHIVE ZIP — service PUR, sans dépendance (27/10/2026).
//
// Un .docx est une archive ZIP. Pour remplir le Word du DIPEC tel qu'EODA l'a mis en
// page (couleurs, tableaux, numérotation — demande de Damon), la tablette ouvre
// l'archive, réécrit `word/document.xml`, puis la referme avec `buildStoredZip`.
// Tout se fait dans le navigateur : le contrat rempli ne passe jamais par le serveur
// (verrou HDS).
//
// La décompression est INJECTÉE : le navigateur passe `DecompressionStream
// ("deflate-raw")`, les tests passent `node:zlib`. Seules les méthodes 0 (stocké) et
// 8 (deflate) existent dans un .docx ; toute autre est refusée plutôt que devinée.
// ─────────────────────────────────────────────────────────────────────────────

export type InflateRaw = (data: Uint8Array) => Promise<Uint8Array>;
export type ZipEntry = { name: string; data: Uint8Array };

export class ZipReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipReadError";
  }
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const dv = view(bytes);
  // Le commentaire d'archive fait au plus 65 535 octets.
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (dv.getUint32(i, true) === EOCD) return i;
  }
  throw new ZipReadError("Ce fichier n'est pas une archive ZIP.");
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function readZip(bytes: Uint8Array, inflateRaw: InflateRaw): Promise<ZipEntry[]> {
  const dv = view(bytes);
  const end = findEndOfCentralDirectory(bytes);
  const count = dv.getUint16(end + 10, true);
  let cursor = dv.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > bytes.length || dv.getUint32(cursor, true) !== CENTRAL) throw new ZipReadError("Répertoire de l'archive illisible.");
    const method = dv.getUint16(cursor + 10, true);
    const compressedSize = dv.getUint32(cursor + 20, true);
    const nameLength = dv.getUint16(cursor + 28, true);
    const extraLength = dv.getUint16(cursor + 30, true);
    const commentLength = dv.getUint16(cursor + 32, true);
    const localOffset = dv.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (localOffset + 30 > bytes.length || dv.getUint32(localOffset, true) !== LOCAL) throw new ZipReadError("Entrée de l'archive illisible.");
    // Les longueurs du nom et du champ « extra » LOCAUX peuvent différer du répertoire.
    const start = localOffset + 30 + dv.getUint16(localOffset + 26, true) + dv.getUint16(localOffset + 28, true);
    const raw = bytes.subarray(start, start + compressedSize);
    if (raw.length !== compressedSize) throw new ZipReadError("Archive tronquée.");
    if (name.endsWith("/")) continue;
    if (method === 0) entries.push({ name, data: raw.slice() });
    else if (method === 8) entries.push({ name, data: await inflateRaw(raw) });
    else throw new ZipReadError(`Méthode de compression inconnue (${method}).`);
  }
  return entries;
}

// Décompression du navigateur (Safari 16.4+, Chrome 80+). Sans elle, la tablette
// retombe sur la copie en texte du contrat.
export function browserInflateRaw(): InflateRaw | null {
  if (typeof DecompressionStream !== "function") return null;
  return async (data) => {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
}
