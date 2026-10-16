import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { CorrectionProposal } from "@/lib/llm/correction-proposal";
import {
  additionInsert,

  criterionCaption,
  type ChangeReportRow,
  type DecisionMap,
} from "./correction-proposal-service";
import { brandedFooter, brandedHeader, markdownToParagraphs, reviewMentionParagraphs } from "./markdown-to-docx-service";

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS WORD DE LA MISE EN CONFORMITÉ (N8, context/10 §4) — les DEUX livrables :
//   1. le document ANNOTÉ : ajouts surlignés en vert, chacun suivi d'un encart
//      « ajouté car réclamé par le critère HAS X, absent de la version initiale »
//      (avec la ligne du manuel quand elle a été vérifiée), champs à compléter en
//      pointillé, sommaire, numéros de page, et la MENTION de relecture
//      (review-mention-service — jamais rédigée ici) ;
//   2. le RAPPORT DES CHANGEMENTS, séparé : ce qui était demandé / ce qui a été fait.
// Le plan (`buildAnnotatedPlan`) est pur et testé ; la mise en .docx n'en est que le
// rendu.
// ─────────────────────────────────────────────────────────────────────────────

export type AnnotatedBlock =
  | { kind: "MENTION"; text: string }
  | { kind: "ORIGINAL"; markdown: string }
  | { kind: "ADDITION"; markdown: string; caption: string; insert: string };

// `decisions` absent : la proposition entière (avant décision). Présent : les ajouts
// ACCEPTÉS seulement — un ajout refusé ou sans décision n'apparaît pas.
export function buildAnnotatedPlan(
  proposal: CorrectionProposal,
  options: { decisions?: DecisionMap; labels: ReadonlyMap<string, string>; mention: string | null }
): AnnotatedBlock[] {
  const blocks: AnnotatedBlock[] = options.mention ? [{ kind: "MENTION", text: options.mention }] : [];
  for (const segment of proposal.segments) {
    if (segment.kind === "ORIGINAL") {
      blocks.push({ kind: "ORIGINAL", markdown: segment.text });
    } else if (!options.decisions || options.decisions.get(segment.id) === "ACCEPTE") {
      blocks.push({
        kind: "ADDITION",
        markdown: segment.text,
        caption: criterionCaption(segment, options.labels),
        insert: additionInsert(segment),
      });
    }
  }
  return blocks;
}

function insertParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: "F3EDE6", color: "auto" },
    border: { left: { style: "single", size: 6, color: "3E2C26", space: 6 } },
    children: [new TextRun({ text, italics: true, size: 18, color: "3E2C26" })],
  });
}

function planToParagraphs(plan: readonly AnnotatedBlock[]): Paragraph[] {
  return plan.flatMap((block) => {
    if (block.kind === "MENTION") return reviewMentionParagraphs(block.text);
    if (block.kind === "ORIGINAL") return markdownToParagraphs(block.markdown);
    return [...markdownToParagraphs(block.markdown, { addition: true }), insertParagraph(`${block.caption}. ${block.insert}`)];
  });
}

export async function generateAnnotatedDocx(input: {
  title: string;
  establishmentName: string;
  plan: readonly AnnotatedBlock[];
}): Promise<Buffer> {
  const document = new Document({
    // Le sommaire se remplit à l'ouverture dans Word (mise à jour des champs).
    features: { updateFields: true },
    sections: [
      {
        headers: { default: brandedHeader() },
        footers: { default: brandedFooter(input.establishmentName) },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: input.title, bold: true })] }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Légende : ", bold: true }),
              new TextRun({ text: "ajout proposé", highlight: "green" }),
              new TextRun(" · "),
              new TextRun({ text: "[À compléter : …]", highlight: "yellow", underline: { type: "dotted" } }),
            ],
          }),
          new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-3" }),
          ...planToParagraphs(input.plan),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}

// ── Rapport des changements ──────────────────────────────────────────────────

function cell(text: string, header = false): TableCell {
  return new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, bold: header })] })],
  });
}

export function changeReportTitle(documentLabel: string): string {
  return `Rapport des changements — ${documentLabel}`;
}

export async function generateChangeReportDocx(input: {
  documentLabel: string;
  establishmentName: string;
  versionCaption: string;
  mention: string | null;
  rows: readonly ChangeReportRow[];
}): Promise<Buffer> {
  const header = new TableRow({
    tableHeader: true,
    children: [cell("Critère HAS", true), cell("Ce qui était demandé", true), cell("Ce qui a été fait", true)],
  });
  const rows = input.rows.map(
    (row) => new TableRow({ children: [cell(row.criterion), cell(row.requested), cell(`${row.done} — ${row.text}`)] })
  );
  const document = new Document({
    sections: [
      {
        headers: { default: brandedHeader() },
        footers: { default: brandedFooter(input.establishmentName) },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: changeReportTitle(input.documentLabel), bold: true })] }),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun(input.versionCaption)] }),
          ...reviewMentionParagraphs(input.mention),
          input.rows.length > 0
            ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })
            : new Paragraph("Aucun ajout n'a été proposé."),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}

