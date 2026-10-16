import { toSafeFilenameSegment } from "@/lib/security/upload-validation-service";
import { ChromiumLaunchError } from "@/lib/services/chromium-launch-error";
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

// Ce qu'on dit à l'écran quand le rendu n'a pas abouti. Une seule distinction, mais
// elle est décisive : Chromium qui ne DÉMARRE pas échouera au clic suivant comme au
// précédent, donc on ne propose pas de réessayer — on oriente vers le téléchargement du
// format d'origine, qui marche, lui. Recomposer à la main cette distinction dans chaque
// route, c'est la route qu'on oubliera de corriger (D1) : elle se décide ici, à partir
// du type d'erreur, et `devis-pdf-failure.ts` tient la même règle côté devis.
//
// Le détail technique (binaire Linux, variable d'environnement à poser) reste dans le
// journal serveur — jamais à l'écran d'une structure, encore moins d'un client.
export function documentPdfPreviewFailureMessage(error: unknown): string {
  if (error instanceof ChromiumLaunchError) {
    return "Aperçu paginé indisponible sur ce serveur. Téléchargez le document dans son format d'origine pour le consulter.";
  }
  return "La préparation de l'aperçu a échoué. Réessayez, ou téléchargez le document dans son format d'origine.";
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
