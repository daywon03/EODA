// ─────────────────────────────────────────────────────────────────────────────
// PAGE IMPRIMABLE — le HTML autonome remis à Chromium pour produire les pages d'un
// document déposé (document-pdf-render-service), et le NETTOYAGE de ce qui entre
// dedans.
//
// Aucune dépendance : ni serveur, ni storage, ni puppeteer. Cette page est rendue
// par un navigateur sans CSS de l'application (elle n'existe pas — Chromium imprime
// du HTML autonome, hors du bundle Next). La mise en page est donc ÉCRITE ICI, en
// clair, une fois pour toutes les conversions.
//
// Pas une seule couleur de la charte : on reproduit le document d'une STRUCTURE, pas
// une pièce EODA. Les gris neutres évitent aussi d'inventer un hexadécimal de la
// charte recopié à la main, qui divergerait de `globals.css` sans que rien ne le
// signale (D1 — une valeur n'existe qu'à un endroit).
// ─────────────────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Nettoyage d'un HTML converti depuis un fichier DÉPOSÉ ────────────────────
//
// Ce HTML vient d'un .docx que quelqu'un nous a envoyé : c'est une entrée HOSTILE.
// Deux menaces, deux raisons de filtrer :
//
//   - une ressource DISTANTE (`<img src="http://…">`, `<link>`, `url()` dans un
//     style) ferait sortir une requête du serveur vers une adresse choisie par le
//     fichier. C'est un SSRF — la cible la plus utile étant le service de
//     métadonnées de l'hébergeur. Le rendu neutralise aussi le réseau de son côté
//     (`renderHtmlToPdf` refuse toute requête non-`data:`), mais un filtre de plus
//     coûte moins cher qu'un pari ;
//   - un `<script>` embarqué s'exécuterait dans la page que Chromium rend. Il n'a
//     accès ni à nos cookies ni à notre session (la page n'a pas d'origine), mais
//     il peut faire échouer le rendu — donc l'aperçu.
//
// Ce filtre n'est PAS un analyseur HTML, et il ne prétend pas l'être : c'est une
// barrière complémentaire, pas la seule. Il retire ce qu'un convertisseur ne produit
// jamais et qu'un fichier piégé produit toujours.
const PAIRED_DANGEROUS = /<\s*(script|iframe|object|embed|form|style|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const VOID_DANGEROUS = /<\s*\/?\s*(link|meta|base|input|button|embed|source|track)\b[^>]*>/gi;
// `style` en ATTRIBUT : un `background: url(...)` y charge une ressource distante.
const STYLE_ATTRIBUTE = /\sstyle\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const EVENT_ATTRIBUTE = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
// Toute URL qui n'est ni embarquée (`data:`) ni une ancre reste du réseau ou du
// système de fichiers : on la retire. `mailto:`/`tel:` sont conservés — un document
// imprimé peut légitimement en porter.
const REMOTE_URL_ATTRIBUTE =
  /\s(?:src|href|background|poster|srcset|action|formaction|data)\s*=\s*(?:"(?!(?:data:|#|mailto:|tel:))[^"]*"|'(?!(?:data:|#|mailto:|tel:))[^']*'|(?!(?:data:|#|mailto:|tel:))[^\s"'>]+)/gi;

export function sanitizeExtractedHtml(html: string): string {
  return html
    .replace(PAIRED_DANGEROUS, "")
    .replace(VOID_DANGEROUS, "")
    .replace(STYLE_ATTRIBUTE, "")
    .replace(EVENT_ATTRIBUTE, "")
    .replace(REMOTE_URL_ATTRIBUTE, "");
}

// ── Corps de page ────────────────────────────────────────────────────────────

// Un texte reconstruit (texte extrait, ou fichier texte lu tel quel) : il n'a aucune
// mise en forme à respecter, donc il se lit tel quel, sans réinterprétation.
export function buildTextBodyHtml(text: string): string {
  return `<pre class="plain">${escapeHtml(text)}</pre>`;
}

export function buildImageBodyHtml(dataUri: string, alt: string): string {
  return `<img class="page-image" src="${escapeHtml(dataUri)}" alt="${escapeHtml(alt)}" />`;
}

// ── Page complète ────────────────────────────────────────────────────────────

const PAGE_STYLES = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #26262b;
    background: #ffffff;
  }
  .doc-head { margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 0.5pt solid #d8d8dd; }
  .doc-head h1 { margin: 0; font-size: 15pt; font-weight: 600; line-height: 1.25; }
  .doc-head p { margin: 3pt 0 0; font-size: 9.5pt; color: #5c5c66; }
  .notice {
    margin: 0 0 12pt;
    padding: 7pt 9pt;
    border-left: 2.5pt solid #8a8a94;
    background: #f4f4f6;
    font-size: 9.5pt;
    color: #45454f;
  }
  h1, h2, h3, h4 { page-break-after: avoid; }
  h2 { font-size: 13pt; } h3 { font-size: 11.5pt; } h4 { font-size: 11pt; }
  p { margin: 0 0 8pt; }
  ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
  img { max-width: 100%; height: auto; }
  .page-image { display: block; margin: 0 auto; max-height: 240mm; }
  pre.plain { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .sheet h2 { margin: 0 0 6pt; font-size: 12pt; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 10pt; font-size: 9pt; }
  th, td { border: 0.5pt solid #c9c9d0; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #f1f1f4; font-weight: 600; }
`;

export type PrintablePage = {
  title: string;
  subtitle: string | null;
  bodyHtml: string;
  // Affiché en tête quand ce qui suit n'est pas fidèle au document d'origine.
  notice: string | null;
};

export function buildPrintableHtml(page: PrintablePage): string {
  const notice = page.notice ? `<p class="notice">${escapeHtml(page.notice)}</p>` : "";
  const subtitle = page.subtitle ? `<p>${escapeHtml(page.subtitle)}</p>` : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(page.title)}</title>
<style>${PAGE_STYLES}</style>
</head>
<body>
<header class="doc-head"><h1>${escapeHtml(page.title)}</h1>${subtitle}</header>
${notice}
${page.bodyHtml}
</body>
</html>`;
}
