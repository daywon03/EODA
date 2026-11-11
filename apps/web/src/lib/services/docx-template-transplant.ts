import { readZip, type InflateRaw } from "./zip-read";
import { buildStoredZip } from "./zip-store";
import type { CoverPage } from "./final-document-service";

// ─────────────────────────────────────────────────────────────────────────────
// GARDER LE DESIGN DU CLIENT DANS LE DOCUMENT FINAL — greffe du corps dans SON Word
// (retour de Damon, 11/11/2026 : « pour la mise en conformité le problème est qu'il ne
// garde pas le design des documents, il modifie tout »).
//
// Avant : le .docx final était reconstruit de zéro (generateBrandedDocx) — polices,
// styles de titres, en-têtes, pieds, logo et marges du client perdus. Désormais, quand
// on dispose d'un Word du client (la version corrigée elle-même, sinon le modèle de
// mise en page déposé pour la structure), on garde TOUT le paquet (styles.xml, en-têtes,
// pieds, images, thème, numérotation) et on ne remplace que le CORPS de
// word/document.xml, écrit avec les STYLES du client (titres, corps, liste, tableau).
// La dernière sectPr (format, marges, en-têtes/pieds) est conservée telle quelle.
// La page de garde EODA (E2) précède le document dans sa propre section, sans l'en-tête
// du client ; la mention de relecture reste dans le document.
// Limite assumée : les images du CORPS d'origine ne sont pas reprises (le texte est
// réécrit) ; celles des en-têtes et pieds, si.
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateStyles = {
  title: string | null;
  headings: [string | null, string | null, string | null];
  body: string | null;
  // `bulleted` : le style porte sa puce (« List Bullet ») ; sinon on l'écrit.
  list: { id: string; bulleted: boolean } | null;
  table: string | null;
};

// Le NOM interne d'un style intégré (« heading 1 », « List Paragraph ») ne dépend pas de
// la langue de Word ; son identifiant, si (« Titre1 » en français).
export function readTemplateStyles(stylesXml: string): TemplateStyles {
  const byName = new Map<string, string>();
  let body: string | null = null;
  let table: string | null = null;
  for (const match of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const attrs = match[1] ?? "";
    const id = /w:styleId="([^"]+)"/.exec(attrs)?.[1];
    const type = /w:type="([^"]+)"/.exec(attrs)?.[1];
    const name = /<w:name w:val="([^"]+)"/.exec(match[2] ?? "")?.[1]?.toLowerCase();
    if (!id || !name) continue;
    if (type === "paragraph") {
      byName.set(name, id);
      if (/w:default="1"/.test(attrs)) body = id;
    }
    if (type === "table" && (name === "table grid" || table === null) && name !== "normal table") table = id;
  }
  return {
    title: byName.get("title") ?? null,
    headings: [byName.get("heading 1") ?? null, byName.get("heading 2") ?? null, byName.get("heading 3") ?? null],
    body: body ?? byName.get("normal") ?? null,
    list: byName.has("list bullet")
      ? { id: byName.get("list bullet")!, bulleted: true }
      : byName.has("list paragraph")
        ? { id: byName.get("list paragraph")!, bulleted: false }
        : null,
    table,
  };
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function run(text: string, props = ""): string {
  if (text.length === 0) return "";
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

// **gras**, *italique* — le reste du texte tel quel.
function inlineRuns(line: string): string {
  let out = "";
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    out += run(line.slice(last, match.index));
    out += match[2] !== undefined ? run(match[2], "<w:b/>") : run(match[3] ?? "", "<w:i/>");
    last = (match.index ?? 0) + match[0].length;
  }
  return out + run(line.slice(last));
}

function paragraph(style: string | null, content: string): string {
  return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${escapeXml(style)}"/></w:pPr>` : ""}${content}</w:p>`;
}

function tableXml(rows: string[][], style: string | null): string {
  const borders = style
    ? ""
    : '<w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders>';
  const tblPr = `<w:tblPr>${style ? `<w:tblStyle w:val="${escapeXml(style)}"/>` : ""}<w:tblW w:w="5000" w:type="pct"/>${borders}</w:tblPr>`;
  const body = rows
    .map((cells) => `<w:tr>${cells.map((cell) => `<w:tc><w:p>${inlineRuns(cell)}</w:p></w:tc>`).join("")}</w:tr>`)
    .join("");
  return `<w:tbl>${tblPr}${body}</w:tbl>`;
}

const TABLE_ROW = /^\s*\|(.+)\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

export function markdownToWordXml(markdown: string, styles: TemplateStyles): string {
  const parts: string[] = [];
  let tableRows: string[][] = [];
  const flushTable = () => {
    if (tableRows.length > 0) parts.push(tableXml(tableRows, styles.table));
    tableRows = [];
  };
  const heading = (level: number): string | null =>
    styles.headings[Math.min(level, 3) - 1] ?? styles.headings[1] ?? styles.headings[0] ?? styles.body;

  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    if (TABLE_SEPARATOR.test(line) && tableRows.length > 0) continue;
    const row = TABLE_ROW.exec(line);
    if (row) {
      tableRows.push((row[1] ?? "").split("|").map((cell) => cell.trim()));
      continue;
    }
    flushTable();
    if (line.trim().length === 0) continue;
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      parts.push(paragraph(heading(h[1]!.length), inlineRuns(h[2]!)));
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      // Le style de liste du client ; sans lui, une puce écrite dans le corps.
      const text = styles.list?.bulleted ? bullet[1]! : `• ${bullet[1]!}`;
      parts.push(paragraph(styles.list?.id ?? styles.body, inlineRuns(text)));
      continue;
    }
    parts.push(paragraph(styles.body, inlineRuns(line)));
  }
  flushTable();
  return parts.join("");
}

// Remplace le contenu de <w:body> en gardant la DERNIÈRE sectPr (mise en page du client).
export function replaceBody(documentXml: string, bodyXml: string): string {
  const open = /<w:body>/.exec(documentXml);
  const close = documentXml.lastIndexOf("</w:body>");
  if (!open || close < 0) throw new Error("Corps du document Word introuvable.");
  const start = open.index + open[0].length;
  const inner = documentXml.slice(start, close);
  const sect = inner.lastIndexOf("<w:sectPr");
  const sectPr = sect >= 0 ? inner.slice(sect) : "";
  return documentXml.slice(0, start) + bodyXml + sectPr + documentXml.slice(close);
}

function finalSectPr(documentXml: string): string | null {
  const close = documentXml.lastIndexOf("</w:body>");
  const sect = documentXml.lastIndexOf("<w:sectPr", close);
  return sect >= 0 && close > sect ? documentXml.slice(sect, close) : null;
}

// Page de garde EODA : sa propre section, même format que le document, SANS les
// en-têtes et pieds du client (elle se détache).
function coverXml(cover: CoverPage, styles: TemplateStyles, sectPr: string | null): string {
  const p = (text: string, props = "") => paragraph(styles.body, run(text, props));
  const parts = [
    p("EODA Conseil", "<w:b/>"),
    paragraph(styles.title ?? styles.headings[0], run(cover.title)),
    p(cover.coverageHeading, "<w:b/>"),
    p(cover.coverageText),
    ...cover.criteria.map((c) => paragraph(styles.body, run(`• ${c.code}`, "<w:b/>") + run(` — ${c.label}`))),
    p(cover.detachNote, "<w:i/>"),
    p(cover.ownershipMention, "<w:i/>"),
  ];
  const coverSect = (sectPr ?? "<w:sectPr></w:sectPr>")
    .replace(/<w:headerReference\b[^>]*\/>/g, "")
    .replace(/<w:footerReference\b[^>]*\/>/g, "")
    .replace(/<w:titlePg\b[^>]*\/>/g, "");
  return parts.join("") + `<w:p><w:pPr>${coverSect}</w:pPr></w:p>`;
}

export type TransplantInput = {
  markdown: string;
  cover: CoverPage | null;
  reviewMention: string | null;
};

export async function transplantIntoTemplate(template: Uint8Array, inflateRaw: InflateRaw, input: TransplantInput): Promise<Uint8Array> {
  const entries = await readZip(template, inflateRaw);
  const decode = (data: Uint8Array) => new TextDecoder().decode(data);
  const documentEntry = entries.find((e) => e.name === "word/document.xml");
  if (!documentEntry) throw new Error("Ce fichier Word n'a pas de corps lisible.");
  const stylesEntry = entries.find((e) => e.name === "word/styles.xml");
  const styles = readTemplateStyles(stylesEntry ? decode(stylesEntry.data) : "");
  const documentXml = decode(documentEntry.data);

  const body =
    (input.cover ? coverXml(input.cover, styles, finalSectPr(documentXml)) : "") +
    markdownToWordXml(input.markdown, styles) +
    (input.reviewMention ? paragraph(styles.body, run(input.reviewMention, "<w:b/>")) : "");
  const next = new TextEncoder().encode(replaceBody(documentXml, body));
  const now = new Date();
  return buildStoredZip(
    entries.map((e) => ({ name: e.name, data: e.name === "word/document.xml" ? next : e.data, modifiedAt: now }))
  );
}

// ── Comprendre la mise en page d'un client (assistant du menu, 11/11/2026) ─────
// Ce que l'assistant LIT d'un Word pour en parler et proposer des consignes : police et
// taille du corps, police / couleur / taille des titres, textes et logo de l'en-tête,
// pied, format et marges. Rien n'est deviné : un champ absent reste null.

export type DocxDesign = {
  bodyFont: string | null;
  bodySizePt: number | null;
  headingFont: string | null;
  headingColor: string | null;
  headingSizePt: number | null;
  headerTexts: string[];
  footerTexts: string[];
  headerHasImage: boolean;
  pageSize: string | null;
  marginsCm: Partial<Record<"top" | "bottom" | "left" | "right", number>>;
};

const textOf = (xml: string): string =>
  [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("").replace(/\s+/g, " ").trim();
const halfPoints = (xml: string | undefined): number | null => {
  const value = xml ? /<w:sz w:val="(\d+)"/.exec(xml)?.[1] : undefined;
  return value ? Number(value) / 2 : null;
};
const font = (xml: string | undefined): string | null => (xml ? (/<w:rFonts\b[^>]*w:ascii="([^"]+)"/.exec(xml)?.[1] ?? null) : null);

export function describeDocxDesign(entries: readonly { name: string; data: Uint8Array }[]): DocxDesign {
  const decode = (name: string) => {
    const entry = entries.find((e) => e.name === name);
    return entry ? new TextDecoder().decode(entry.data) : "";
  };
  const styles = decode("word/styles.xml");
  const defaults = /<w:docDefaults>([\s\S]*?)<\/w:docDefaults>/.exec(styles)?.[1];
  const heading = [...styles.matchAll(/<w:style\b[^>]*>([\s\S]*?)<\/w:style>/g)].find((m) =>
    /<w:name w:val="heading 1"/i.test(m[1] ?? "")
  )?.[1];
  const color = heading ? /<w:color w:val="([0-9A-Fa-f]{6})"/.exec(heading)?.[1] : undefined;

  const parts = (prefix: string) => entries.filter((e) => new RegExp(`^word/${prefix}\\d*\\.xml$`).test(e.name)).map((e) => new TextDecoder().decode(e.data));
  const headers = parts("header");
  const footers = parts("footer");

  const documentXml = decode("word/document.xml");
  const sect = documentXml.slice(documentXml.lastIndexOf("<w:sectPr"));
  const pgSz = /<w:pgSz\b([^>]*)\/>/.exec(sect)?.[1] ?? "";
  const w = Number(/w:w="(\d+)"/.exec(pgSz)?.[1] ?? 0);
  const h = Number(/w:h="(\d+)"/.exec(pgSz)?.[1] ?? 0);
  const isA4 = (a: number, b: number) => Math.abs(a - 11906) < 60 && Math.abs(b - 16838) < 60;
  const pageSize = w && h ? (isA4(w, h) ? "A4 portrait" : isA4(h, w) ? "A4 paysage" : `${Math.round(w / 56.7) / 10} × ${Math.round(h / 56.7) / 10} cm`) : null;
  const pgMar = /<w:pgMar\b([^>]*)\/>/.exec(sect)?.[1] ?? "";
  const marginsCm: DocxDesign["marginsCm"] = {};
  for (const side of ["top", "bottom", "left", "right"] as const) {
    const twips = /w:(\w+)="(\d+)"/g;
    for (const m of pgMar.matchAll(twips)) if (m[1] === side) marginsCm[side] = Math.round((Number(m[2]) / 567) * 10) / 10;
  }

  return {
    bodyFont: font(defaults),
    bodySizePt: halfPoints(defaults),
    headingFont: font(heading),
    headingColor: color ? `#${color.toUpperCase()}` : null,
    headingSizePt: halfPoints(heading),
    headerTexts: headers.map(textOf).filter(Boolean),
    footerTexts: footers.map(textOf).filter(Boolean),
    headerHasImage: headers.some((x) => /<w:drawing|<w:pict|<v:imagedata/.test(x)),
    pageSize,
    marginsCm,
  };
}

export function summarizeDocxDesign(design: DocxDesign): string {
  const parts: string[] = [];
  if (design.bodyFont || design.bodySizePt) parts.push(`corps en ${design.bodyFont ?? "police par défaut"}${design.bodySizePt ? ` ${design.bodySizePt} pt` : ""}`);
  if (design.headingFont || design.headingColor || design.headingSizePt) {
    parts.push(
      `titres en ${design.headingFont ?? design.bodyFont ?? "police du corps"}${design.headingSizePt ? ` ${design.headingSizePt} pt` : ""}${design.headingColor ? `, couleur ${design.headingColor}` : ""}`
    );
  }
  if (design.headerTexts.length > 0 || design.headerHasImage) {
    parts.push(`en-tête : ${design.headerTexts.join(" / ") || "sans texte"}${design.headerHasImage ? " (avec logo ou image)" : ""}`);
  }
  if (design.footerTexts.length > 0) parts.push(`pied de page : ${design.footerTexts.join(" / ")}`);
  if (design.pageSize) parts.push(`format ${design.pageSize}`);
  const margins = Object.entries(design.marginsCm).map(([side, cm]) => `${({ top: "haut", bottom: "bas", left: "gauche", right: "droite" } as Record<string, string>)[side]} ${cm} cm`);
  if (margins.length > 0) parts.push(`marges ${margins.join(", ")}`);
  return parts.length > 0 ? parts.join(" ; ") : "Mise en page non lisible dans ce fichier.";
}
