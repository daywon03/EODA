import { inflateRawSync } from "node:zlib";
import { DOCX_MIME_TYPE, validateUploadedFile, XLSX_MIME_TYPE, type UploadValidationResult } from "./upload-validation-service";

// ─────────────────────────────────────────────────────────────────────────────
// BOMBE DE DÉCOMPRESSION — contrôle d'un .docx / .xlsx DÉPOSÉ (audit du 28/10/2026).
//
// Un fichier Office est une archive ZIP. 20 Mo compressés peuvent se décompresser en
// plusieurs Go : mammoth et ExcelJS chargent tout en mémoire, la fonction serveur tombe,
// et un dépôt répété suffit à rendre l'analyse indisponible. Le contrôle de signature ne
// le voyait pas (il ne lit que l'en-tête).
//
// La taille annoncée par l'archive peut MENTIR : on décompresse donc réellement chaque
// entrée, avec un plafond (`maxOutputLength`, zlib s'arrête au-delà), avant que
// l'archive n'atteigne un analyseur. Serveur seulement (node:zlib).
// ─────────────────────────────────────────────────────────────────────────────

export const OFFICE_ARCHIVE_LIMITS = {
  // Un livret d'accueil de 80 pages avec images reste loin en dessous.
  maxUncompressedBytes: 200 * 1024 * 1024,
  maxEntries: 5000,
} as const;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function endOfCentralDirectory(bytes: Buffer): number {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i -= 1) {
    if (bytes.readUInt32LE(i) === EOCD) return i;
  }
  return -1;
}

// null : l'archive est saine ; sinon, la raison du refus (phrase à afficher).
export function officeArchiveProblem(bytes: Buffer, limits: { maxUncompressedBytes: number; maxEntries: number } = OFFICE_ARCHIVE_LIMITS): string | null {
  const unreadable = "Ce fichier Office est abîmé ou piégé : il ne peut pas être analysé.";
  const tooBig = "Ce fichier Office est trop volumineux une fois décompressé : il ne peut pas être analysé.";
  const end = endOfCentralDirectory(bytes);
  if (end < 0) return unreadable;
  const count = bytes.readUInt16LE(end + 10);
  if (count > limits.maxEntries) return tooBig;

  let cursor = bytes.readUInt32LE(end + 16);
  let budget = limits.maxUncompressedBytes;
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== CENTRAL) return unreadable;
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    cursor += 46 + nameLength + extraLength + commentLength;

    if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== LOCAL) return unreadable;
    const start = localOffset + 30 + bytes.readUInt16LE(localOffset + 26) + bytes.readUInt16LE(localOffset + 28);
    const data = bytes.subarray(start, start + compressedSize);
    if (data.length !== compressedSize) return unreadable;

    if (method === 0) {
      budget -= compressedSize;
    } else if (method === 8) {
      try {
        budget -= inflateRawSync(data, { maxOutputLength: Math.max(1, budget) }).length;
      } catch (error) {
        return error instanceof RangeError ? tooBig : unreadable;
      }
    } else {
      return unreadable;
    }
    if (budget < 0) return tooBig;
  }
  return null;
}

// La validation d'un dépôt CÔTÉ SERVEUR : la même que partout (`validateUploadedFile`),
// plus la décompression bornée d'une archive Office. C'est elle qu'appellent les
// actions de dépôt et l'ingestion.
export function validateUploadOnServer(content: Buffer, declaredSizeBytes: number): UploadValidationResult {
  const validation = validateUploadedFile(content, declaredSizeBytes);
  if (!validation.ok) return validation;
  if (validation.contentType === DOCX_MIME_TYPE || validation.contentType === XLSX_MIME_TYPE) {
    const problem = officeArchiveProblem(content);
    if (problem) return { ok: false, error: problem };
  }
  return validation;
}
