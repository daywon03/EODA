import { inlineOriginalType, type InlineOriginalType } from "./document-original-response";

// ─────────────────────────────────────────────────────────────────────────────
// LE LOGO D'UNE STRUCTURE, SERVI À L'ÉCRAN (21/10/2026 — call du 18/10 : « le logo a
// disparu des cartes clients, on ne reconnaît plus les clients d'un coup d'œil »).
//
// Le logo est rangé en base sous forme d'URI `data:` (jusqu'à 300 Ko). L'écrire tel
// quel dans une liste de structures alourdirait la page de plusieurs mégaoctets ; il
// part donc par une route (`/api/establishments/[id]/logo`), que le navigateur met en
// cache. Ce module décode l'URI — et ne sert QUE du PNG ou du JPEG reconnu par
// signature, quelle que soit l'étiquette écrite dans l'URI.
// ─────────────────────────────────────────────────────────────────────────────

const DATA_URI = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/;

export function decodeLogoDataUri(dataUri: string | null): { bytes: Buffer; type: InlineOriginalType } | null {
  if (!dataUri) return null;
  const match = DATA_URI.exec(dataUri);
  if (!match?.[1]) return null;
  const bytes = Buffer.from(match[1], "base64");
  const type = inlineOriginalType(bytes);
  if (type !== "image/png" && type !== "image/jpeg") return null;
  return { bytes, type };
}

export function establishmentLogoUrl(establishmentId: string): string {
  return `/api/establishments/${encodeURIComponent(establishmentId)}/logo`;
}

// Le logo de LA structure du compte client connecté : la route résout la structure
// depuis le lien du compte (garde), jamais depuis un identifiant reçu. Ouverte à tout
// rôle d'accès de la structure — l'intervenant, qui n'a pas le module Documents, voit
// lui aussi le logo de sa structure dans la coquille.
export const CLIENT_LOGO_URL = "/api/client/logo";

// Ajoute la version (date de mise à jour de la fiche) : le navigateur garde la route
// en cache une heure, un nouveau logo doit donc changer d'adresse. Sans logo : null,
// l'écran n'affiche rien plutôt qu'une image cassée.
export function versionedLogoUrl(baseUrl: string, version: number | null): string | null {
  return version === null ? null : `${baseUrl}?v=${version}`;
}
