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
  HighlightColor,
  PageNumber,
  UnderlineType,
  BorderStyle,
  type ISectionOptions,
} from "docx";
import { imageSize } from "image-size";
import { buildOwnershipMention } from "./document-ownership-service";
import { toDocxColor, type BrandColors } from "./brand-color-service";
import type { CoverPage } from "./final-document-service";

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

// Style des passages d'un document ANNOTÉ (N8, context/10 §4) : un ajout proposé est
// surligné en vert ; un champ `[À compléter : …]` est souligné en pointillé et surligné
// en jaune, « pour qu'on sache que c'est là qu'il faut remplir ».
export type RunStyle = { addition?: boolean };

const FIELD_SPLIT = /(\[À compléter[^\]]*\])/g;

// `**gras**` au milieu d'une ligne — le seul style inline que le prompt de
// génération utilise — et les champs à compléter. Jamais imbriqué.
export function parseInlineRuns(line: string, style: RunStyle = {}, color?: string): TextRun[] {
  const segments = line.split(/(\*\*[^*]+\*\*)/g).filter((segment) => segment.length > 0);
  if (segments.length === 0) return [new TextRun("")];

  return segments.flatMap((segment) => {
    const bold = segment.startsWith("**") && segment.endsWith("**") && segment.length > 4;
    const text = bold ? segment.slice(2, -2) : segment;
    return text
      .split(FIELD_SPLIT)
      .filter((part) => part.length > 0)
      .map((part) => {
        const isField = /^\[À compléter/.test(part);
        return new TextRun({
          text: part,
          ...(bold && { bold: true }),
          ...(color && !isField && !style.addition && { color }),
          ...(isField
            ? { highlight: HighlightColor.YELLOW, underline: { type: UnderlineType.DOTTED } }
            : style.addition
              ? { highlight: HighlightColor.GREEN }
              : {}),
        });
      });
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

// Charte du client appliquée au CORPS du document final (E1) : titres H1/H2 dans la
// couleur principale (lisible sur le blanc, vérifié à la saisie), filet sous H1 dans
// la secondaire. Absente : le style Word par défaut, comme avant.
export type BodyTheme = { headingColor: string; ruleColor: string };

export function bodyTheme(colors: BrandColors | null): BodyTheme | undefined {
  return colors ? { headingColor: toDocxColor(colors.primary), ruleColor: toDocxColor(colors.secondary) } : undefined;
}

function headingDecoration(level: number, theme: BodyTheme | undefined) {
  if (!theme || level !== 1) return {};
  return { border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: theme.ruleColor, space: 4 } } };
}

export function markdownToParagraphs(markdown: string, style: RunStyle = {}, theme?: BodyTheme): Paragraph[] {
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
          ...headingDecoration(level, theme),
          spacing: { before: 240, after: 120 },
          children: parseInlineRuns(heading[2]!, style, theme && level <= 2 ? theme.headingColor : undefined),
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
          children: parseInlineRuns(bullet[1]!, style),
        })
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        spacing: { after: 160 },
        children: parseInlineRuns(line, style),
      })
    );
  }

  return paragraphs;
}

export type BrandedDocxImageInput = {
  buffer: Buffer;
  contentType: string;
  description: string | null;
  // Numéro d'apparition dans le document d'origine (DocumentVersionImage.position)
  // — utilisé pour légender l'annexe avec le VRAI numéro, celui qui correspond au
  // repère [Image N] laissé dans le texte extrait, jamais l'index dans ce tableau
  // (cf. revue de branche : une image omise, best-effort, décalerait sinon la
  // numérotation de toutes celles qui suivent).
  position: number;
};

export type BrandedDocxInput = {
  markdown: string;
  title: string;
  establishmentName: string;
  images?: BrandedDocxImageInput[];
  // Mention de relecture produite par review-mention-service (« Relu par EODA… » ou,
  // en autonomie, la réserve complète). Jamais rédigée ici : une réserve recopiée
  // finit tronquée. Absente ou null : aucune mention ajoutée.
  reviewMention?: string | null;
  // Page de garde EODA détachable (E2, call du 09/11/2026) : logo EODA seul, ce que
  // couvre le document et ses critères (matrice), paternité. Première SECTION du
  // fichier ; le document de la structure commence à la page suivante, numéroté à 1.
  coverPage?: CoverPageInput;
  // Effigie et couleurs de la STRUCTURE (E1), appliquées au document seulement —
  // jamais à la page de garde, qui garde la charte EODA. Absente : en-tête EODA et
  // style par défaut, comme avant.
  brand?: DocxBrand;
};

export type DocxImage = { data: Buffer; type: "png" | "jpg" };
export type CoverPageInput = CoverPage & { eodaLogo: Buffer | null };
export type DocxBrand = { colors: BrandColors | null; logo: DocxImage | null };

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

  for (const image of images) {
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
            new TextRun({ text: `Image ${image.position} — ${image.description}`, italics: true, size: 18 }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

// La mention de relecture, en tête du document et en gras : c'est la première chose
// à lire avant d'utiliser un document qu'aucun humain n'a revérifié (CLAUDE.md §7).
// Exportée pour être testée sans dézipper le .docx.
// Pied de page commun : la mention de paternité, puis le numéro de page en bas à
// droite (context/10 §4 : « numéros de page en bas à droite »).
export function brandedFooter(establishmentName: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: buildOwnershipMention(establishmentName), size: 16, color: EODA_GRIS_MID })],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 16 })],
      }),
    ],
  });
}

export function brandedHeader(): Header {
  return new Header({
    children: [new Paragraph({ children: [new TextRun({ text: "EODA conseil", bold: true, color: EODA_BRUN_ANCRE, size: 20 })] })],
  });
}

// Image mise à l'échelle d'une hauteur cible, proportions gardées (logos).
function scaledImage(image: DocxImage, targetHeight: number, maxWidth: number): ImageRun | null {
  try {
    const { width, height } = imageSize(image.data);
    if (!width || !height) return null;
    const scale = Math.min(targetHeight / height, maxWidth / width);
    return new ImageRun({
      type: image.type,
      data: image.data,
      transformation: { width: Math.round(width * scale), height: Math.round(height * scale) },
    });
  } catch {
    return null;
  }
}

// En-tête du document FINAL : l'effigie de la structure — son logo, sinon son NOM
// (jamais un emplacement vide, CLAUDE.md « Deux mentions »), dans sa couleur.
export function structureHeader(establishmentName: string, brand: DocxBrand): Header {
  const logo = brand.logo ? scaledImage(brand.logo, 40, 160) : null;
  const color = brand.colors ? toDocxColor(brand.colors.primary) : EODA_BRUN_ANCRE;
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [logo ?? new TextRun({ text: establishmentName, bold: true, color, size: 20 })],
      }),
    ],
  });
}

// Pied de page de la page de garde : la paternité, sans numéro de page (la page se
// détache ; le document est numéroté à partir de 1).
function coverFooter(mention: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: mention, size: 16, color: EODA_GRIS_MID })],
      }),
    ],
  });
}

const DRAFT_NOTICE =
  "Brouillon généré automatiquement à l'appui de la préparation — à relire et compléter " +
  "avant toute remise à la structure. Ne vaut ni évaluation HAS ni validation finale.";

function draftNoticeParagraph(): Paragraph {
  return new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: DRAFT_NOTICE, italics: true, color: EODA_GRIS_MID, size: 18 })],
  });
}

// Page de garde EODA (E2) — charte EODA seule : le logo EODA, jamais celui du client.
export function coverPageParagraphs(cover: CoverPageInput): Paragraph[] {
  const logo = cover.eodaLogo ? scaledImage({ data: cover.eodaLogo, type: "png" }, 70, 220) : null;
  return [
    new Paragraph({
      spacing: { after: 480 },
      children: [logo ?? new TextRun({ text: "EODA conseil", bold: true, color: EODA_BRUN_ANCRE, size: 32 })],
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 360 },
      children: [new TextRun({ text: cover.title, bold: true, color: EODA_BRUN_ANCRE })],
    }),
    new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: cover.coverageHeading, bold: true, color: EODA_BRUN_ANCRE, size: 28 })],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun(cover.coverageText)] }),
    ...cover.criteria.map(
      (criterion) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: criterion.code, bold: true }), new TextRun(` — ${criterion.label}`)],
        })
    ),
    new Paragraph({
      spacing: { before: 480 },
      children: [new TextRun({ text: cover.detachNote, italics: true, color: EODA_GRIS_MID, size: 18 })],
    }),
    draftNoticeParagraph(),
  ];
}

export function reviewMentionParagraphs(mention: string | null): Paragraph[] {
  if (!mention) return [];
  return [
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: mention, bold: true, color: EODA_BRUN_ANCRE })],
    }),
  ];
}

// Rend un Buffer .docx prêt à être servi (Content-Type
// application/vnd.openxmlformats-officedocument.wordprocessingml.document).
export async function generateBrandedDocx(input: BrandedDocxInput): Promise<Buffer> {
  const theme = bodyTheme(input.brand?.colors ?? null);
  const documentSection: ISectionOptions = {
    // Avec une page de garde, le document de la structure est numéroté à partir de 1.
    ...(input.coverPage && { properties: { page: { pageNumbers: { start: 1 } } } }),
    headers: { default: input.brand ? structureHeader(input.establishmentName, input.brand) : brandedHeader() },
    // Mention de paternité — texte fixe, dicté et jamais reformulé au cas par
    // cas (cf. document-ownership-service.ts) — et numéro de page.
    footers: { default: brandedFooter(input.establishmentName) },
    children: [
      new Paragraph({
        heading: HeadingLevel.TITLE,
        ...(theme && { border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: theme.ruleColor, space: 6 } } }),
        children: [new TextRun({ text: input.title, bold: true, color: theme?.headingColor ?? EODA_BRUN_ANCRE })],
      }),
      // Réserve écrite deux fois dans le cahier des charges (§5, §7) : un document
      // produit par l'IA n'atteint jamais la structure sans revue humaine. Avec une
      // page de garde, ce rappel interne y passe (« les encarts, c'est pour nous ») ;
      // la mention de relecture, elle, reste dans le document.
      ...(input.coverPage ? [] : [draftNoticeParagraph()]),
      ...reviewMentionParagraphs(input.reviewMention ?? null),
      ...markdownToParagraphs(input.markdown, {}, theme),
      ...buildImageAnnexParagraphs(input.images ?? []),
    ],
  };

  const sections: ISectionOptions[] = input.coverPage
    ? [
        { footers: { default: coverFooter(input.coverPage.ownershipMention) }, children: coverPageParagraphs(input.coverPage) },
        documentSection,
      ]
    : [documentSection];

  return Packer.toBuffer(new Document({ sections }));
}

