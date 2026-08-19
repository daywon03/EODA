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

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export type DetectedFileType = typeof PDF_MIME_TYPE | typeof DOCX_MIME_TYPE;

const PDF_SIGNATURE = Buffer.from("%PDF-", "latin1");
// DOCX est une archive ZIP (OOXML) — signature d'en-tête d'entrée locale ZIP.
const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// Détecte le type réel à partir du contenu, en ignorant le type déclaré.
// Retourne null si la signature ne correspond à aucun format accepté.
export function detectFileType(content: Buffer): DetectedFileType | null {
  if (content.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    return PDF_MIME_TYPE;
  }
  if (content.subarray(0, ZIP_SIGNATURE.length).equals(ZIP_SIGNATURE)) {
    // Un .docx est un ZIP contenant "word/" — le vérifier évite d'accepter un
    // .xlsx, un .zip quelconque ou une archive piégée sous un nom en .docx.
    // Recherche bornée à l'en-tête : les noms d'entrées ZIP apparaissent dès le
    // début du fichier, pas besoin de décompresser.
    const header = content.subarray(0, Math.min(content.length, 4096)).toString("latin1");
    return header.includes("word/") ? DOCX_MIME_TYPE : null;
  }
  return null;
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
      error: "Format non supporté — seuls les fichiers PDF et DOCX sont acceptés.",
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
