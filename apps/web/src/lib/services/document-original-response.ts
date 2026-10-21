import {
  detectFileType,
  DOCX_MIME_TYPE,
  JPEG_MIME_TYPE,
  PDF_MIME_TYPE,
  PNG_MIME_TYPE,
  toSafeFilenameSegment,
} from "@/lib/security/upload-validation-service";

// ─────────────────────────────────────────────────────────────────────────────
// SERVIR UN ORIGINAL À L'ÉCRAN — PDF et photos seulement, et seulement s'ils SONT
// ce qu'ils prétendent être (21/10/2026).
//
// La visionneuse affiche un PDF ou une photo tels que déposés, par
// `/api/documents/[versionId]/original`, plutôt que par une URL de stockage signée
// qu'il fallait d'abord demander au serveur. Servir un fichier déposé par un tiers
// depuis NOTRE domaine a un risque précis : un fichier HTML ou SVG nommé `.pdf`
// s'exécuterait avec nos cookies. D'où trois règles, toutes ici :
//   - le type se décide par SIGNATURE (`detectFileType`), jamais par le nom ;
//   - seuls PDF, JPEG et PNG passent — un SVG ou un HTML n'a aucun chemin ;
//   - l'en-tête `Content-Type` porte le type DÉTECTÉ, pas celui qu'on suppose.
// ─────────────────────────────────────────────────────────────────────────────

const INLINE_TYPES = [PDF_MIME_TYPE, JPEG_MIME_TYPE, PNG_MIME_TYPE] as const;
// Word (21/10/2026) : servi pour que la visionneuse le DESSINE dans le navigateur avec
// sa mise en page (docx-preview) — jamais affiché tel quel par le navigateur : il part
// en pièce jointe (`attachment`), le script de la visionneuse le lit par `fetch`.
const SERVED_TYPES = [...INLINE_TYPES, DOCX_MIME_TYPE] as const;
export type InlineOriginalType = (typeof SERVED_TYPES)[number];

export function inlineOriginalType(content: Buffer): InlineOriginalType | null {
  const detected = detectFileType(content);
  return SERVED_TYPES.find((type) => type === detected) ?? null;
}

// Nom assaini (liste blanche ASCII) : concaténé tel quel dans un en-tête, un nom
// d'origine porteur de guillemets ou de retour à la ligne injecterait des en-têtes.
export function inlineOriginalFilename(originalFilename: string): string {
  return toSafeFilenameSegment(originalFilename);
}

export function inlineOriginalHeaders(type: InlineOriginalType, originalFilename: string): Record<string, string> {
  return {
    "Content-Type": type,
    "Content-Disposition": `${type === DOCX_MIME_TYPE ? "attachment" : "inline"}; filename="${inlineOriginalFilename(originalFilename)}"`,
    // `private` : un document d'établissement n'a rien à faire dans un cache partagé.
    // `no-store` : l'effacer doit le faire disparaître de l'écran.
    "Cache-Control": "private, no-store",
    // Le navigateur ne devine jamais un autre type que celui déclaré. La politique de
    // sécurité des routes /api (next.config.ts : `default-src 'none'`,
    // `frame-ancestors 'self'`) s'applique aussi. Pas de `sandbox` ici : il empêche le
    // lecteur PDF du navigateur de s'afficher dans le cadre de la visionneuse.
    "X-Content-Type-Options": "nosniff",
  };
}
