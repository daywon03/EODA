// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION DES FICHIERS DÉPOSÉS — pur, sans dépendance framework ni stockage
//
// Deux protections distinctes, souvent confondues :
//
//  1. Type réel du fichier. `File.type` est une valeur envoyée par le client dans
//     le multipart : elle est falsifiable. On vérifie donc la signature binaire
//     (magic bytes) et on n'accepte que ce que le pipeline d'extraction sait
//     réellement traiter (pdf-parse / mammoth).
//
//  2. Clé de stockage. Le nom de fichier d'origine ne doit JAMAIS être concaténé
//     tel quel dans une clé de stockage : `../../` y échappe le préfixe de
//     l'établissement (écriture hors racine sur le stockage local, écrasement de
//     l'objet d'un autre établissement sur un stockage S3-compatible qui normalise
//     les chemins). Le nom d'origine reste conservé en base
//     (DocumentVersion.originalFilename) pour l'affichage et le téléchargement —
//     il n'a pas à servir d'identifiant physique.
// ─────────────────────────────────────────────────────────────────────────────

export const PDF_MIME_TYPE = "application/pdf";
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
// Anciennes versions bureautiques : .doc et .xls partagent le même conteneur OLE2,
// que la seule signature ne permet pas de distinguer. On les accepte comme un même
// type « document bureautique ancien » — c'est vrai, et suffisant : aucun des deux
// n'est analysable, ils sont conservés comme pièces.
export const LEGACY_OFFICE_MIME_TYPE = "application/x-ole-storage";
export const JPEG_MIME_TYPE = "image/jpeg";
export const PNG_MIME_TYPE = "image/png";
export const CSV_MIME_TYPE = "text/csv";

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export type DetectedFileType =
  | typeof PDF_MIME_TYPE
  | typeof DOCX_MIME_TYPE
  | typeof XLSX_MIME_TYPE
  | typeof LEGACY_OFFICE_MIME_TYPE
  | typeof JPEG_MIME_TYPE
  | typeof PNG_MIME_TYPE
  | typeof CSV_MIME_TYPE;

// Formats dont le pipeline sait extraire du texte, donc analysables. Les autres sont
// stockés comme pièces : les accepter sans le dire ferait attendre une analyse qui ne
// viendrait jamais.
const ANALYSABLE_TYPES: DetectedFileType[] = [PDF_MIME_TYPE, DOCX_MIME_TYPE];

export function isAnalysableType(type: DetectedFileType): boolean {
  return ANALYSABLE_TYPES.includes(type);
}

const PDF_SIGNATURE = Buffer.from("%PDF-", "latin1");
// DOCX et XLSX sont des archives ZIP (OOXML) — signature d'en-tête d'entrée locale ZIP.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
// Conteneur OLE2 : .doc et .xls d'avant Office 2007.
const OLE2_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(content: Buffer, signature: Buffer): boolean {
  return content.subarray(0, signature.length).equals(signature);
}

// Détecte le type réel à partir du contenu, en ignorant le type déclaré.
// Retourne null si la signature ne correspond à aucun format accepté.
export function detectFileType(content: Buffer): DetectedFileType | null {
  if (startsWith(content, PDF_SIGNATURE)) return PDF_MIME_TYPE;
  if (startsWith(content, JPEG_SIGNATURE)) return JPEG_MIME_TYPE;
  if (startsWith(content, PNG_SIGNATURE)) return PNG_MIME_TYPE;
  if (startsWith(content, OLE2_SIGNATURE)) return LEGACY_OFFICE_MIME_TYPE;

  if (startsWith(content, ZIP_SIGNATURE)) {
    // Un .docx contient « word/ », un .xlsx contient « xl/ » — le vérifier évite
    // d'accepter une archive quelconque, ou piégée, sous un nom en .docx.
    // Recherche bornée à l'en-tête : les noms d'entrées ZIP apparaissent dès le
    // début du fichier, pas besoin de décompresser.
    const header = content.subarray(0, Math.min(content.length, 4096)).toString("latin1");
    if (header.includes("word/")) return DOCX_MIME_TYPE;
    if (header.includes("xl/")) return XLSX_MIME_TYPE;
    return null;
  }

  // CSV : aucune signature n'existe, par construction — c'est du texte. Reconnu donc
  // par son CONTENU : du texte imprimable, sans octet nul (ce qui écarte tout binaire
  // renommé), et au moins un séparateur de colonnes sur la première ligne.
  //
  // C'est l'exception assumée à la règle « type déterminé par signature binaire » :
  // un fichier texte n'en a pas. Le risque est borné — un CSV n'est ni exécuté ni
  // rendu par le navigateur (il est servi en pièce jointe), et le contrôle refuse
  // tout ce qui contient un octet nul.
  if (looksLikeCsv(content)) return CSV_MIME_TYPE;

  return null;
}

// Un CSV a une FORME, et c'est elle qu'on vérifie faute de signature : au moins deux
// lignes non vides, portant le même nombre de séparateurs. Une charge utile d'une
// seule ligne — un webshell, un script — ne la présente pas, et se voit refusée
// comme avant.
function looksLikeCsv(content: Buffer): boolean {
  const head = content.subarray(0, Math.min(content.length, 8192));
  if (head.includes(0)) return false;

  const text = head.toString("utf8");
  // Le remplacement U+FFFD signale un octet invalide en UTF-8 : ce n'est pas du texte.
  if (text.includes("\uFFFD")) return false;

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0).slice(0, 5);
  if (lines.length < 2) return false;

  return [";", ",", "\t"].some((separator) => {
    const counts = lines.map((line) => line.split(separator).length - 1);
    const first = counts[0] ?? 0;
    return first > 0 && counts.every((count) => count === first);
  });
}

export type UploadValidationResult =
  | { ok: true; contentType: DetectedFileType }
  | { ok: false; error: string };

export function validateUploadedFile(
  content: Buffer,
  declaredSizeBytes: number
): UploadValidationResult {
  if (declaredSizeBytes === 0 || content.length === 0) {
    return { ok: false, error: "Le fichier est vide." };
  }
  // Contrôle sur la taille réellement lue, pas seulement sur celle annoncée.
  if (content.length > MAX_FILE_SIZE_BYTES || declaredSizeBytes > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "Fichier trop volumineux (20 Mo maximum)." };
  }

  const detected = detectFileType(content);
  if (!detected) {
    return {
      ok: false,
      error:
        "Format non reconnu. Formats acceptés : PDF, Word (.doc, .docx), Excel (.xls, .xlsx), CSV, images (JPEG, PNG).",
    };
  }

  return { ok: true, contentType: detected };
}

// Réduit un nom de fichier à un segment de chemin sûr : pas de séparateur, pas de
// traversée, pas d'octet nul, longueur bornée. Sert uniquement de suffixe lisible
// dans la clé de stockage — le nom d'origine reste en base.
export function toSafeFilenameSegment(filename: string): string {
  const withoutPath = filename.split(/[/\\]/).pop() ?? "";
  const sanitized = withoutPath
    .normalize("NFKD")
    // Liste blanche stricte : tout ce qui n'est pas alphanumérique ASCII, point,
    // tiret ou underscore devient un tiret. Couvre du même coup les octets de
    // contrôle, les séparateurs de chemin et les caractères non-ASCII.
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "") // jamais un nom commençant par "." (fichier caché) ou "-"
    .replace(/-{2,}/g, "-")
    .slice(0, 80);

  return sanitized.length > 0 ? sanitized : "document";
}

// Construit la clé de stockage. L'établissement et le type de document forment le
// préfixe (cloisonnement lisible côté bucket), le nom d'origine n'intervient que
// sous forme assainie.
export function buildStorageKey(params: {
  establishmentId: string;
  documentTypeId: string;
  versionNumber: number;
  originalFilename: string;
  timestamp: number;
}): string {
  const { establishmentId, documentTypeId, versionNumber, originalFilename, timestamp } = params;
  const safeName = toSafeFilenameSegment(originalFilename);
  return `${establishmentId}/${documentTypeId}/v${versionNumber}-${timestamp}-${safeName}`;
}
