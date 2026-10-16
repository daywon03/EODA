import TurndownService from "turndown";
import ExcelJS from "exceljs";
import {
  PDF_MIME_TYPE,
  DOCX_MIME_TYPE,
  XLSX_MIME_TYPE,
} from "@/lib/security/upload-validation-service";

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION EN MARKDOWN — sert de base au texte stocké dans `DocumentVersion`
// (analyse LLM d'un document client) ET aux documents de RÉFÉRENCE de la
// bibliothèque de modèles (chunking + embeddings, cf. knowledge-indexing-service.ts).
//
// Une seule fonction pour les deux usages : décision du 07/09/2026. Le Markdown
// préserve les titres et les tableaux qu'un texte aplati aurait effacés — un
// manuel HAS ou un tableau d'habilitations se découpe en chunks bien plus
// cohérents, et Claude raisonne mieux sur une structure explicite qu'un mur de
// texte. La frontière qui empêche un document CLIENT d'entrer dans la base de
// connaissances partagée ne vit PAS ici : elle vit dans template-library.ts, qui
// n'appelle l'indexation vectorielle que pour un document de RÉFÉRENCE. Améliorer
// ce que cette fonction rend ne change rien à qui a le droit d'être indexé.
// ─────────────────────────────────────────────────────────────────────────────

const turndown = new TurndownService({ headingStyle: "atx" });

export type ExtractedImage = { position: number; contentType: string; buffer: Buffer };
export type ExtractionResult = { markdown: string; images: ExtractedImage[] };

export async function extractMarkdown(content: Buffer, mimeType: string): Promise<ExtractionResult | null> {
  try {
    if (mimeType === PDF_MIME_TYPE) {
      const markdown = await extractPdf(content);
      return markdown ? { markdown, images: [] } : null;
    }

    if (mimeType === DOCX_MIME_TYPE) {
      return await extractDocx(content);
    }

    if (mimeType === XLSX_MIME_TYPE) {
      const markdown = await extractXlsx(content);
      return markdown ? { markdown, images: [] } : null;
    }

    return null;
  } catch {
    // Extraction best-effort : un échec ne doit jamais bloquer le dépôt du
    // document, seulement priver la catégorisation/l'analyse de contexte texte.
    return null;
  }
}

async function extractPdf(content: Buffer): Promise<string | null> {
  const pdf2md = (await import("@opendocsg/pdf2md")).default;
  const markdown = await pdf2md(content);
  return markdown.trim() || null;
}

async function extractDocx(content: Buffer): Promise<ExtractionResult | null> {
  const mammoth = await import("mammoth");
  const images: ExtractedImage[] = [];
  let position = 0;

  // Repère `[Image N]` plutôt qu'un <img> en base64 : c'est ce qui évitait jusqu'ici
  // que le texte envoyé à l'IA gonfle d'images entières encodées en base64 — cause
  // constatée de la troncature d'un document long avant même d'atteindre son texte
  // (15/09/2026). L'image elle-même est capturée à part, jamais dans ce texte.
  const imageConverter = mammoth.images.imgElement(async (image) => {
    position += 1;
    const buffer = await image.readAsBuffer();
    images.push({ position, contentType: image.contentType, buffer });
    return { src: `image-placeholder-${position}` };
  });

  const { value: html } = await mammoth.convertToHtml({ buffer: content }, { convertImage: imageConverter });
  const rawMarkdown = turndown.turndown(html);
  // turndown a transformé le <img src="image-placeholder-N"> en `![](image-placeholder-N)` —
  // remplacé ici par un repère texte propre, sans URL ni base64.
  const markdown = rawMarkdown.replace(/!\[[^\]]*\]\(image-placeholder-(\d+)\)/g, "[Image $1]");
  return { markdown: markdown.trim(), images };
}

// LECTURE D'UN CLASSEUR — partagée (16/10/2026). Deux lecteurs veulent les mêmes
// lignes : l'extraction Markdown (ci-dessous, pour le LLM) et le rendu en pages
// imprimables (document-pdf-render-service). Deux boucles `eachSheet` auraient fini
// par ne plus lire les cellules de la même façon — donc par montrer à l'écran autre
// chose que ce que l'IA a lu.
export type SheetRows = { name: string; rows: string[][] };

export async function readWorkbookSheets(content: Buffer): Promise<SheetRows[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(content as unknown as ExcelJS.Buffer);

  const sheets: SheetRows[] = [];
  workbook.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cellToText(cell.value));
      });
      rows.push(cells);
    });
    if (rows.length === 0) return;

    sheets.push({ name: sheet.name, rows });
  });
  return sheets;
}

// Un tableau Markdown par feuille, séparés par un titre — une feuille de calcul
// n'a pas de paragraphes, juste des lignes ; c'est la structure la plus fidèle
// qu'un format texte puisse en donner à un LLM.
async function extractXlsx(content: Buffer): Promise<string | null> {
  const sheets = await readWorkbookSheets(content);

  const markdown = sheets
    .map((sheet) => `## ${sheet.name}\n\n${rowsToMarkdownTable(sheet.rows)}`)
    .join("\n\n")
    .trim();
  return markdown || null;
}

// La VALEUR d'une cellule, telle qu'elle est écrite. Aucun échappement ici : le texte
// lu sert deux sorties qui n'échappent pas la même chose — le Markdown de l'analyse
// (où un `|` couperait la colonne) et les pages de l'aperçu, rendues en HTML (où un
// `\|` s'afficherait tel quel). L'échappement appartient donc au formateur, pas à la
// lecture — il vivait ici, et un tableau contenant un `|` affichait une barre oblique
// dans l'aperçu.
function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in value) return String(value.text);
  if (typeof value === "object" && "result" in value) return String(value.result ?? "");
  return String(value);
}

function rowsToMarkdownTable(rows: string[][]): string {
  const width = Math.max(...rows.map((row) => row.length));
  const pad = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? "");
  // `|` refermerait la cellule, et un saut de ligne casserait la ligne du tableau.
  const cell = (value: string) => value.replace(/\|/g, "\\|").replace(/\n/g, " ");

  const header = rows[0] ?? [];
  const body = rows.slice(1);
  const lines = [
    `| ${pad(header).map(cell).join(" | ")} |`,
    `| ${pad([]).map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${pad(row).map(cell).join(" | ")} |`),
  ];
  return lines.join("\n");
}
