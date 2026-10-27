import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { AdmissionBlock } from "./admission-document-service";
import type { AdmissionSigner } from "./admission-service";

// ─────────────────────────────────────────────────────────────────────────────
// RENDU PDF DU CONTRAT SIGNÉ — dans le navigateur de la tablette, jamais sur le
// serveur (verrou HDS, admission-service). `pdf-lib` est chargé À LA DEMANDE, au
// moment de signer : il ne pèse pas sur l'ouverture de la page.
//
// Le PDF rend le PLAN (admission-document-service) bloc par bloc ; il n'ajoute rien.
// Polices standard (Helvetica, encodage WinAnsi) : aucun fichier de police embarqué,
// et tout caractère hors de l'encodage est remplacé plutôt que de faire échouer la
// signature au dernier geste.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const FOOTER_SPACE = 44;
const WIDTH = PAGE[0] - 2 * MARGIN;
const INK = rgb(0.12, 0.11, 0.1);
const SOFT = rgb(0.33, 0.31, 0.29);
const LINE = rgb(0.8, 0.78, 0.75);

const SIZE = { title: 17, subtitle: 12.5, heading: 12.5, body: 10.5, note: 8.5 } as const;

// Remplacements avant le contrôle d'encodage : espaces fines et symboles courants
// d'un texte Word, qui n'existent pas en WinAnsi.
const REPLACEMENTS: Record<string, string> = {
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ",
  "\t": " ",
  "≤": "<=",
  "≥": ">=",
  "→": "->",
  "←": "<-",
  "✓": "x",
  "✔": "x",
  "☐": "[ ]",
  "□": "[ ]",
  "✂": "",
  "↑": "",
  "​": "",
  "☑": "[x]",
  "☒": "[x]",
  "●": "•",
  "▪": "•",
  "‑": "-",
  "−": "-",
};

export function sanitizeForFont(text: string, supported: ReadonlySet<number>): string {
  let out = "";
  for (const char of text.normalize("NFC")) {
    const replaced = REPLACEMENTS[char] ?? char;
    for (const c of replaced) out += supported.has(c.codePointAt(0)!) ? c : "?";
  }
  return out;
}

// Coupe un texte en lignes qui tiennent dans `maxWidth`. Un mot plus large que la
// ligne (une adresse e-mail, une empreinte) est coupé lettre à lettre.
export function wrapText(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  const push = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    push();
    if (measure(word) <= maxWidth) {
      line = word;
      continue;
    }
    let piece = "";
    for (const char of word) {
      if (measure(piece + char) > maxWidth && piece) {
        lines.push(piece);
        piece = "";
      }
      piece += char;
    }
    line = piece;
  }
  push();
  return lines.length > 0 ? lines : [""];
}

class Layout {
  page: PDFPage;
  y: number;
  constructor(
    private readonly doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
    private readonly supported: ReadonlySet<number>
  ) {
    this.page = doc.addPage(PAGE);
    this.y = PAGE[1] - MARGIN;
  }

  ensure(height: number): void {
    if (this.y - height >= MARGIN + FOOTER_SPACE) return;
    this.page = this.doc.addPage(PAGE);
    this.y = PAGE[1] - MARGIN;
  }

  text(raw: string, options: { font?: PDFFont; size: number; color?: ReturnType<typeof rgb>; indent?: number; gapAfter?: number }): void {
    const font = options.font ?? this.regular;
    const indent = options.indent ?? 0;
    const lineHeight = options.size * 1.38;
    const lines = wrapText(sanitizeForFont(raw, this.supported), (s) => font.widthOfTextAtSize(s, options.size), WIDTH - indent);
    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.page.drawText(line, { x: MARGIN + indent, y: this.y + options.size * 0.28, size: options.size, font, color: options.color ?? INK });
    }
    this.y -= options.gapAfter ?? 0;
  }

  rule(): void {
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE[0] - MARGIN, y: this.y }, thickness: 0.6, color: LINE });
    this.y -= 6;
  }
}

function drawSignature(layout: Layout, block: Extract<AdmissionBlock, { kind: "signature" }>, image: PDFImage | undefined): void {
  const boxHeight = 78;
  layout.ensure(boxHeight + 50);
  layout.text(block.label, { font: layout.bold, size: SIZE.body });
  layout.text(`${block.name} · signé le ${block.when}`, { size: SIZE.body, color: SOFT, gapAfter: 4 });
  if (image) {
    const scale = Math.min(220 / image.width, boxHeight / image.height, 1);
    layout.page.drawImage(image, { x: MARGIN, y: layout.y - image.height * scale, width: image.width * scale, height: image.height * scale });
  }
  layout.y -= boxHeight;
  layout.rule();
  layout.y -= 6;
}

function drawBlock(layout: Layout, block: AdmissionBlock, images: Partial<Record<AdmissionSigner, PDFImage>>): void {
  switch (block.kind) {
    case "title":
      layout.text(block.text, { font: layout.bold, size: SIZE.title, gapAfter: 2 });
      return;
    case "subtitle":
      layout.text(block.text, { size: SIZE.subtitle, color: SOFT, gapAfter: 4 });
      return;
    case "heading":
      // Un titre ne reste jamais seul en bas de page : on réserve la place de
      // quelques lignes de ce qu'il annonce.
      layout.ensure(110);
      layout.y -= 10;
      layout.text(block.text, { font: layout.bold, size: SIZE.heading, gapAfter: 2 });
      layout.rule();
      return;
    case "field":
      layout.text(`${block.label} : ${block.value}`, { size: SIZE.body });
      return;
    case "paragraph":
      layout.text(block.text, { size: SIZE.body, gapAfter: 4 });
      return;
    case "check":
      layout.text(`• ${block.text}`, { size: SIZE.body });
      layout.text(block.detail, { size: SIZE.note, color: SOFT, indent: 10, gapAfter: 2 });
      return;
    case "note":
      layout.text(block.text, { size: SIZE.note, color: SOFT, gapAfter: 4 });
      return;
    case "signature":
      drawSignature(layout, block, images[block.signer]);
      return;
  }
}

export type AdmissionPdfInput = {
  blocks: readonly AdmissionBlock[];
  signatures: Partial<Record<AdmissionSigner, Uint8Array>>;
  footer: string;
  title: string;
  signedAt: Date;
};

export async function renderAdmissionPdf(input: AdmissionPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set([...regular.getCharacterSet()].filter((code) => bold.getCharacterSet().includes(code)));
  const images: Partial<Record<AdmissionSigner, PDFImage>> = {};
  for (const [signer, png] of Object.entries(input.signatures) as [AdmissionSigner, Uint8Array][]) {
    images[signer] = await doc.embedPng(png);
  }

  const layout = new Layout(doc, regular, bold, supported);
  for (const block of input.blocks) drawBlock(layout, block, images);

  const pages = doc.getPages();
  const footer = sanitizeForFont(input.footer, supported);
  pages.forEach((page, index) => {
    const label = wrapText(`${footer} · page ${index + 1} / ${pages.length}`, (s) => regular.widthOfTextAtSize(s, SIZE.note), WIDTH)[0]!;
    page.drawText(label, { x: MARGIN, y: MARGIN - 20, size: SIZE.note, font: regular, color: SOFT });
  });

  doc.setTitle(sanitizeForFont(input.title, supported));
  doc.setSubject("Document individuel de prise en charge signé sur tablette");
  doc.setCreator("EODA — tablette terrain");
  doc.setProducer("EODA");
  doc.setCreationDate(input.signedAt);
  doc.setModificationDate(input.signedAt);
  return doc.save();
}

// « data:image/png;base64,… » (SignaturePad) → octets du PNG.
export function pngDataUrlToBytes(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const binary = atob(match[1]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
