import { toSafeFilenameSegment } from "@/lib/security/upload-validation-service";
import { escapeHtml } from "@/lib/services/printable-html-service";

// ─────────────────────────────────────────────────────────────────────────────
// LES DEUX RÉPONSES COMMUNES AUX ROUTES QUI SERVENT DES PAGES EN PDF (16/10/2026) —
// documents clients (`/api/documents/[versionId]/pdf`) et documents de la bibliothèque
// de modèles (`/api/templates/versions/[versionId]/pdf`).
//
// Elles étaient écrites deux fois, à l'identique, dans les deux routes. La deuxième
// copie est le seuil de D1 : ce qui change d'un côté cesse de changer de l'autre, et
// c'est l'en-tête `Content-Disposition` qui finirait par diverger — celui qui touche
// au nom du fichier remis au client.
// ─────────────────────────────────────────────────────────────────────────────

// Nom du PDF remis au client. Deux propriétés, et aucune n'est cosmétique :
//   - le nom d'origine est ASSAINI (`toSafeFilenameSegment`) : concaténé tel quel dans
//     un en-tête, un nom porteur de guillemets ou de retour à la ligne injecte des
//     en-têtes ;
//   - l'extension devient `.pdf` : ce qui part est un PDF, quel que soit le format
//     déposé — un fichier nommé `.docx` que le navigateur enregistrerait en `.docx`
//     s'ouvrirait dans Word sur des octets PDF.
export function documentPdfFilename(originalFilename: string): string {
  const base = toSafeFilenameSegment(originalFilename).replace(/\.[a-zA-Z0-9]+$/, "");
  return `${base}.pdf`;
}

// Message d'échec rendu en HTML et non en JSON : il s'affiche dans un `<iframe>`, où
// du JSON brut ne se lit pas. Sans style ni script, donc rien que la politique de
// sécurité du contenu puisse bloquer, et rien à charger.
//
// Le message est ÉCHAPPÉ : les appelants passent aujourd'hui des littéraux, mais c'est
// une fonction de rendu HTML — le jour où quelqu'un y glisse un intitulé de document
// (qui vient d'un tiers), un `<` refermerait le paragraphe. L'échappement ici ne coûte
// rien et rend l'erreur impossible à transformer en balisage.
export function documentPdfErrorResponse(status: number, message: string): Response {
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8" /><title>Aperçu indisponible</title></head><body><p>${escapeHtml(message)}</p></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}
