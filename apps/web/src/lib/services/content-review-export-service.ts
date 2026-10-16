import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { csvCell } from "./survey-report-service";
import type { ContentReviewCatalog, ReviewField } from "./content-review-service";

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS DES CONTENUS À VALIDER — Word et CSV, pour que Sandrine annote hors ligne.
//
// Les deux formats sortent du MÊME catalogue que l'écran (content-review-service) :
// une ligne CSV = un élément affiché ; une section Word = un élément affiché. Chaque
// élément porte son statut et un emplacement d'annotation vide.
// ─────────────────────────────────────────────────────────────────────────────

export type ContentReviewFormat = "csv" | "docx";

// Un format reçu dans l'adresse est une entrée non fiable : inconnu ⇒ null.
export function parseContentReviewFormat(raw: string | null): ContentReviewFormat | null {
  return raw === "csv" || raw === "docx" ? raw : null;
}

const CSV_HEADER = ["Famille", "Élément", "Version", "Identifiant", "Intitulé", "Détail", "Statut", "Annotation de Sandrine"];

function describeFields(entries: readonly ReviewField[]): string {
  return entries.map((field) => `${field.label} : ${field.value}`).join("\n");
}

// Séparateur « ; » et BOM : ouverture correcte dans un tableur français. Cellules
// neutralisées contre l'injection de formule (csvCell).
export function buildContentReviewCsv(catalog: ContentReviewCatalog): string {
  const rows = catalog.families.flatMap((family) =>
    family.groups.flatMap((group) =>
      group.items.map((item) => [family.title, group.title, group.version, item.id, item.title, describeFields(item.fields), catalog.status, ""])
    )
  );
  const lines = [CSV_HEADER, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

// Un texte multiligne devient plusieurs lignes dans le même paragraphe.
function multiline(text: string, bold = false): TextRun[] {
  return text.split("\n").map((line, index) => new TextRun({ text: line, bold, break: index > 0 ? 1 : 0 }));
}

function fieldParagraph(field: ReviewField): Paragraph {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${field.label} : `, bold: true }), ...multiline(field.value)] });
}

export function buildContentReviewParagraphs(catalog: ContentReviewCatalog, issuedOn: string): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Contenus à valider")] }),
    new Paragraph({ children: [new TextRun(`Édité le ${issuedOn}. Statut de chaque élément : ${catalog.status}.`)] }),
    new Paragraph({ children: [new TextRun("Notez vos corrections sous « Annotation ». Document interne EODA.")] }),
  ];
  for (const family of catalog.families) {
    paragraphs.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(family.title)] }));
    paragraphs.push(new Paragraph({ children: [new TextRun(family.description)] }));
    for (const group of family.groups) {
      paragraphs.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${group.title} — ${group.version}`)] }),
        new Paragraph({ children: multiline(group.provenance) })
      );
      for (const item of group.items) {
        paragraphs.push(
          new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(item.title)] }),
          new Paragraph({ children: [new TextRun({ text: `Statut : ${catalog.status}`, italics: true })] }),
          ...item.fields.map(fieldParagraph),
          new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: "Annotation : ", bold: true })] })
        );
      }
    }
  }
  return paragraphs;
}

export async function buildContentReviewDocx(catalog: ContentReviewCatalog, issuedOn: string): Promise<Buffer> {
  const document = new Document({
    creator: "EODA Conseil",
    title: "Contenus à valider",
    sections: [{ children: buildContentReviewParagraphs(catalog, issuedOn) }],
  });
  return Packer.toBuffer(document);
}
