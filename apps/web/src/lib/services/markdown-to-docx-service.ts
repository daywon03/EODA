import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  ImageRun,
} from "docx";
import { imageSize } from "image-size";
import { buildOwnershipMention } from "./document-ownership-service";

// ─────────────────────────────────────────────────────────────────────────────
// MARKDOWN → .DOCX BRANDÉ EODA — sert le document corrigé généré par l'IA (cf.
// document-generation-service.ts). Un seul format source (Markdown) converti à
// l'affichage/au téléchargement : jamais de .docx stocké en base, cf. le
// commentaire sur `DocumentVersion.correctedDraftMarkdown`.
//
// Sous-ensemble volontairement restreint de Markdown — celui que le prompt de
// génération demande explicitement (analysis-prompt.ts §buildGenerationSystemPrompt) :
// titres `#`/`##`/`###`, listes `-`, gras `**`. Pas de tableaux, pas de liens dans
// le corps : un document HAS/loi 2002-2 n'en a pas besoin, et chaque construction
// supplémentaire est une source d'échec de rendu à couvrir. Les images, elles,
// viennent d'ailleurs (D6) : jamais du Markdown généré par l'IA, toujours les
// images d'origine du document déposé, rendues en annexe (cf. `images` ci-dessous).
//
// Couleurs reprises telles quelles de context/04-charte-eoda.md — jamais
// redéfinies ici à l'improviste.
// ─────────────────────────────────────────────────────────────────────────────

const EODA_BRUN_ANCRE = "3E2C26";
const EODA_GRIS_MID = "8A7B72";

// `**gras**` au milieu d'une ligne — le seul style inline que le prompt de
// génération utilise. Découpe la ligne en segments alternant texte normal et gras,
// jamais imbriqué (pas de gras dans du gras : hors du sous-ensemble demandé).
function parseInlineRuns(line: string): TextRun[] {
  const segments = line.split(/(\*\*[^*]+\*\*)/g).filter((segment) => segment.length > 0);
  if (segments.length === 0) return [new TextRun("")];

  return segments.map((segment) => {
    if (segment.startsWith("**") && segment.endsWith("**") && segment.length > 4) {
      return new TextRun({ text: segment.slice(2, -2), bold: true });
    }
    return new TextRun(segment);
  });
}

const HEADING_BY_LEVEL: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};

// `exactOptionalPropertyTypes` refuse `heading: undefined` explicite — l'option ne
// doit tout simplement pas être présente pour un paragraphe sans titre.
function headingProps(level: number): { heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] } | object {
  const heading = HEADING_BY_LEVEL[level];
  return heading ? { heading } : {};
}

function markdownToParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.trim().length === 0) continue;

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      paragraphs.push(
        new Paragraph({
          ...headingProps(level),
          spacing: { before: 240, after: 120 },
          children: parseInlineRuns(heading[2]!),
        })
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      paragraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: parseInlineRuns(bullet[1]!),
        })
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        spacing: { after: 160 },
        children: parseInlineRuns(line),
      })
    );
  }

  return paragraphs;
}

export type BrandedDocxImageInput = {
  buffer: Buffer;
  contentType: string;
  description: string | null;
};

export type BrandedDocxInput = {
  markdown: string;
  title: string;
  establishmentName: string;
  images?: BrandedDocxImageInput[];
};

const MAX_IMAGE_WIDTH = 500;
const DOCX_IMAGE_TYPES: Record<string, "jpg" | "png" | "gif" | "bmp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

// Annexe des images d'origine, jamais réintégrées dans le flux du texte généré
// (repositionner une image à sa place exacte dans un document réécrit par l'IA
// serait fragile — V1 volontairement plus simple : toutes les images d'origine,
// groupées à la fin, chacune légendée par ce qu'elle représente).
function buildImageAnnexParagraphs(images: BrandedDocxImageInput[]): Paragraph[] {
  if (images.length === 0) return [];

  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Annexes — images du document d'origine")],
    }),
  ];

  for (const [index, image] of images.entries()) {
    const type = DOCX_IMAGE_TYPES[image.contentType];
    if (!type) continue; // format non supporté par docx (svg, webp...) — ignoré, jamais bloquant.

    let width = MAX_IMAGE_WIDTH;
    let height = MAX_IMAGE_WIDTH;
    try {
      const dimensions = imageSize(image.buffer);
      if (dimensions.width && dimensions.height) {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / dimensions.width);
        width = Math.round(dimensions.width * scale);
        height = Math.round(dimensions.height * scale);
      }
    } catch {
      // Dimensions illisibles : on garde le carré par défaut plutôt que d'échouer.
    }

    paragraphs.push(
      new Paragraph({
        children: [new ImageRun({ type, data: image.buffer, transformation: { width, height } })],
      })
    );
    if (image.description) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Image ${index + 1} — ${image.description}`, italics: true, size: 18 }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

// Rend un Buffer .docx prêt à être servi (Content-Type
// application/vnd.openxmlformats-officedocument.wordprocessingml.document).
export async function generateBrandedDocx(input: BrandedDocxInput): Promise<Buffer> {
  const document = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "EODA conseil", bold: true, color: EODA_BRUN_ANCRE, size: 20 }),
                ],
              }),
            ],
          }),
        },
        footers: {
          // Mention de paternité — texte fixe, dicté et jamais reformulé au cas par
          // cas (cf. document-ownership-service.ts). Ce document est PRODUIT par
          // EODA pour la structure, exactement le cas que cette mention couvre.
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: buildOwnershipMention(input.establishmentName),
                    size: 16,
                    color: EODA_GRIS_MID,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: input.title, bold: true, color: EODA_BRUN_ANCRE })],
          }),
          // Réserve écrite deux fois dans le cahier des charges (§5, §7) : un
          // document produit par l'IA n'atteint jamais la structure sans revue
          // humaine. Ce rappel reste visible même si le brouillon est ouvert tel
          // quel avant toute relecture.
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text:
                  "Brouillon généré automatiquement à l'appui de la préparation — à relire et compléter " +
                  "avant toute remise à la structure. Ne vaut ni évaluation HAS ni validation finale.",
                italics: true,
                color: EODA_GRIS_MID,
                size: 18,
              }),
            ],
          }),
          ...markdownToParagraphs(input.markdown),
          ...buildImageAnnexParagraphs(input.images ?? []),
        ],
      },
    ],
  });

  return Packer.toBuffer(document);
}
