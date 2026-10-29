import type { Browser } from "puppeteer-core";
import {
  CSV_MIME_TYPE,
  DOCX_MIME_TYPE,
  JPEG_MIME_TYPE,
  PNG_MIME_TYPE,
  XLSX_MIME_TYPE,
  detectFileType,
} from "@/lib/security/upload-validation-service";
import { launchHeadlessChromium } from "@/lib/services/headless-chromium-service";
import {
  buildImageBodyHtml,
  buildTextBodyHtml,
  escapeHtml,
  sanitizeExtractedHtml,
} from "@/lib/services/printable-html-service";
import { readWorkbookSheets, type SheetRows } from "@/lib/services/text-extraction-service";

// ─────────────────────────────────────────────────────────────────────────────
// PAGES D'UN DOCUMENT DÉPOSÉ (16/10/2026) — conversion puis rendu en PDF.
//
// Décision de Damon : « quand on clique sur voir un document, il faut un aperçu du
// document », pour TOUS les documents, alors que la plupart sont des `.docx`. Un
// `.docx` n'a pas de lecteur dans le navigateur ; le convertir en PDF côté serveur
// donne exactement le lecteur attendu (vignettes, « n / N », zoom, rotation,
// téléchargement) — celui du navigateur, donc sans une ligne de code de visualiseur
// et sans un kilo-octet de bundle. Le MÊME rendu sert l'export PDF au téléchargement.
//
// Ce qui n'est pas promis : la fidélité. mammoth reconstruit un document Word
// (paragraphes, titres, listes, tableaux, images) mais pas ses en-têtes, pieds de
// page ni colonnes. La page le DIT, en tête, au lieu de laisser croire à une
// reproduction — même doctrine que la réserve de l'IA : ce qu'on montre de
// non revérifié se signale.
//
// Entrée HOSTILE : le fichier vient d'un tiers. `sanitizeExtractedHtml` filtre le
// HTML converti, et `renderHtmlToPdf` coupe le réseau de Chromium — voir les
// commentaires de ces deux fonctions.
// ─────────────────────────────────────────────────────────────────────────────

export type DocumentBody = { bodyHtml: string; notice: string | null };

// Formats d'image EMBARQUÉS dans la page. Volontairement une liste blanche : un
// `.docx` peut porter du SVG (script inclus) ou de l'EMF/WMF que le navigateur
// n'affiche pas. Le SVG est écarté même si `<img src="data:image/svg+xml">` n'exécute
// pas son script — il n'a rien à faire dans une pièce imprimée.
const EMBEDDABLE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/bmp",
  "image/webp",
]);

// Ce qu'un aperçu reconstruit ne reproduit pas : dit à l'écran, en tête des pages.
const DOCX_NOTICE =
  "Aperçu reconstruit à partir du contenu du fichier : la mise en page Word d'origine (en-têtes, pieds de page, colonnes) n'est pas reproduite.";
const XLSX_NOTICE =
  "Aperçu des feuilles et de leurs valeurs : la mise en forme Excel (couleurs, largeurs, formules) n'est pas reproduite.";

export async function buildDocumentBody(input: {
  originalFilename: string;
  content: Buffer;
}): Promise<DocumentBody | null> {
  // Détection par SIGNATURE, jamais par l'extension ni par le type déclaré au dépôt
  // (§5 bis). Un `.docx` qui n'est pas un OOXML est refusé ici — l'appelant reçoit
  // `null` et le dit, plutôt que de servir des pages vides.
  const detected = detectFileType(input.content);
  if (!detected) return null;

  if (detected === DOCX_MIME_TYPE) {
    const html = await docxToHtml(input.content);
    return html === null ? null : { bodyHtml: sanitizeExtractedHtml(html), notice: DOCX_NOTICE };
  }

  if (detected === XLSX_MIME_TYPE) {
    const sheets = await readWorkbookSheets(input.content);
    if (sheets.length === 0) return null;
    return { bodyHtml: sheetsToHtml(sheets), notice: XLSX_NOTICE };
  }

  if (detected === CSV_MIME_TYPE) {
    // Tel quel, sans réinterprétation : un CSV est du texte, et le seul aperçu
    // honnête est celui de son contenu. Le séparateur peut être `;`, `,` ou une
    // tabulation — un tableau reconstruit se tromperait sur les colonnes.
    return { bodyHtml: buildTextBodyHtml(input.content.toString("utf8")), notice: null };
  }

  if (detected === JPEG_MIME_TYPE || detected === PNG_MIME_TYPE) {
    // `data:` embarqué : la page ne charge rien depuis le réseau, donc rien ne peut
    // échouer pendant le rendu (l'image est déjà là).
    return {
      bodyHtml: buildImageBodyHtml(
        `data:${detected};base64,${input.content.toString("base64")}`,
        input.originalFilename
      ),
      notice: null,
    };
  }

  // PDF (déjà paginé, servi nativement) et OLE2 (.doc/.xls, aucun convertisseur).
  return null;
}

async function docxToHtml(content: Buffer): Promise<string | null> {
  const mammoth = await import("mammoth");

  const convertImage = mammoth.images.imgElement(async (image) => {
    if (!EMBEDDABLE_IMAGE_TYPES.has(image.contentType)) return { src: "" };
    const buffer = await image.readAsBuffer();
    return { src: `data:${image.contentType};base64,${buffer.toString("base64")}` };
  });

  const { value } = await mammoth.convertToHtml({ buffer: content }, { convertImage });
  return value.trim() || null;
}

// Une section par feuille, chacune commençant une page (`.sheet`) : c'est ainsi
// qu'une feuille de calcul se lit, et cela rend `n / N` utile dans le lecteur.
function sheetsToHtml(sheets: SheetRows[]): string {
  return sheets
    .map((sheet) => {
      const rows = sheet.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
        )
        .join("");
      return `<section class="sheet"><h2>${escapeHtml(sheet.name)}</h2><table>${rows}</table></section>`;
    })
    .join("");
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await launchHeadlessChromium();
    const page = await browser.newPage();

    // LE RÉSEAU EST COUPÉ. La page vient d'un fichier déposé par un tiers : si une
    // balise a échappé au filtre et pointe vers une adresse, la requête partirait du
    // serveur — c'est-à-dire depuis le réseau de l'hébergeur, où le service de
    // métadonnées (`169.254.169.254`) répond à qui sait demander. Seules les données
    // embarquées passent (`data:`) ; `about:blank` est la page elle-même.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith("data:") || url.startsWith("about:")) {
        void request.continue();
      } else {
        void request.abort();
      }
    });

    // Et le SCRIPT est coupé (audit du 28/10/2026) : une page de document n'en a aucun
    // besoin, et un script échappé au filtre ne s'exécute pas du tout.
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "a4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser?.close();
  }
}
