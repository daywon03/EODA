import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sanitizeForFont, wrapText } from "./admission-pdf";
import type { FormItem } from "./departement-form-service";

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRITURE PAR-DESSUS LE FORMULAIRE OFFICIEL — dans le navigateur de la tablette,
// jamais sur le serveur. Chargé à la demande (pdf-lib), comme le contrat.
//
// Le texte se RÉDUIT pour tenir dans sa case (jusqu'à 6,5 pt), puis passe à la ligne
// si la case l'autorise ; il ne déborde jamais sur un autre champ. Encre bleu foncé,
// comme une écriture à la main sur un formulaire imprimé.
// ─────────────────────────────────────────────────────────────────────────────

const INK = rgb(0.05, 0.12, 0.42);
const START_SIZE = 10;
const MIN_SIZE = 6.5;

// Le nom est écrit en dur : la minification renomme les classes, et l'écran
// reconnaît cette erreur à son nom (le module est chargé à la demande).
export class OfficialFormMismatchError extends Error {
  override name = "OfficialFormMismatchError";
}

export type FillFormInput = {
  officialPdf: Uint8Array;
  officialSha256: string;
  actualSha256: string;
  items: readonly FormItem[];
  signaturePng: Uint8Array | null;
};

export async function fillOfficialForm(input: FillFormInput): Promise<Uint8Array> {
  if (input.actualSha256 !== input.officialSha256) {
    throw new OfficialFormMismatchError("Le formulaire officiel a changé : les positions des champs sont à mesurer de nouveau.");
  }
  const doc = await PDFDocument.load(input.officialPdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(font.getCharacterSet());
  const signature = input.signaturePng ? await doc.embedPng(input.signaturePng) : null;
  const pages = doc.getPages();

  for (const item of input.items) {
    const page = pages[item.page];
    if (!page) continue;
    if (item.kind === "check") {
      page.drawText("X", { x: item.cx - 3.3, y: item.y + 0.8, size: 10, font: bold, color: INK });
      continue;
    }
    if (item.kind === "image") {
      if (!signature) continue;
      const scale = Math.min(item.maxWidth / signature.width, item.maxHeight / signature.height, 1);
      page.drawImage(signature, { x: item.x, y: item.y, width: signature.width * scale, height: signature.height * scale });
      continue;
    }
    const value = sanitizeForFont(item.text, supported);
    const maxLines = item.maxLines ?? 1;
    let size = START_SIZE;
    let lines = wrapText(value, (s) => font.widthOfTextAtSize(s, size), item.maxWidth);
    while ((lines.length > maxLines || (maxLines === 1 && font.widthOfTextAtSize(value, size) > item.maxWidth)) && size > MIN_SIZE) {
      size = Math.max(MIN_SIZE, size - 0.5);
      lines = wrapText(value, (s) => font.widthOfTextAtSize(s, size), item.maxWidth);
    }
    lines.slice(0, maxLines).forEach((line, index) => {
      page.drawText(line, { x: item.x, y: item.y - index * (size + 2), size, font, color: INK });
    });
  }
  doc.setModificationDate(new Date());
  return doc.save();
}
