import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { Document, ImageRun, Packer, Paragraph } from "docx";
import { DOCX_MIME_TYPE, XLSX_MIME_TYPE } from "@/lib/security/upload-validation-service";
import { extractMarkdown } from "./text-extraction-service";

async function buildWorkbookBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Habilitations");
  sheet.addRow(["Nom", "Poste", "Habilité"]);
  sheet.addRow(["Dupont", "Aide à domicile", "Oui"]);
  sheet.addRow(["Martin", "Coordinateur | référent", "Non"]);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// PNG 1x1 transparent minimal — suffisant pour mammoth : seul le type de contenu
// et la présence d'un flux binaire comptent ici, pas le rendu visuel.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function buildDocxWithImage(): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph("Un paragraphe avec une image ci-dessous."),
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: ONE_PIXEL_PNG,
                transformation: { width: 1, height: 1 },
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

describe("extractMarkdown — XLSX", () => {
  it("rend chaque feuille en tableau Markdown, avec en-tête et séparateur", async () => {
    const buffer = await buildWorkbookBuffer();
    const result = await extractMarkdown(buffer, XLSX_MIME_TYPE);

    expect(result).not.toBeNull();
    expect(result?.markdown).toContain("## Habilitations");
    expect(result?.markdown).toContain("| Nom | Poste | Habilité |");
    expect(result?.markdown).toContain("| --- | --- | --- |");
    expect(result?.markdown).toContain("| Dupont | Aide à domicile | Oui |");
    expect(result?.images).toHaveLength(0);
  });

  it("échappe un caractère `|` présent dans une cellule", async () => {
    const buffer = await buildWorkbookBuffer();
    const result = await extractMarkdown(buffer, XLSX_MIME_TYPE);

    // Un `|` non échappé casserait la structure du tableau Markdown.
    expect(result?.markdown).toContain("Coordinateur \\| référent");
  });

  it("rend null pour un classeur sans aucune feuille visible", async () => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    expect(await extractMarkdown(buffer, XLSX_MIME_TYPE)).toBeNull();
  });

  it("rend null pour un type MIME non pris en charge", async () => {
    const buffer = Buffer.from("peu importe");
    expect(await extractMarkdown(buffer, "image/png")).toBeNull();
  });

  it("rend null plutôt que de lever sur un contenu corrompu — l'extraction est best-effort", async () => {
    const buffer = Buffer.from("ceci n'est pas un classeur Excel valide");
    expect(await extractMarkdown(buffer, XLSX_MIME_TYPE)).toBeNull();
  });
});

describe("extractMarkdown — DOCX", () => {
  it("sort les images du Markdown au lieu de les inliner en base64", async () => {
    const buffer = await buildDocxWithImage();
    const result = await extractMarkdown(buffer, DOCX_MIME_TYPE);

    expect(result).not.toBeNull();
    expect(result?.markdown).not.toMatch(/data:image/);
    expect(result?.markdown).toContain("[Image 1]");
    expect(result?.images).toHaveLength(1);
    expect(result?.images[0]?.contentType).toBe("image/png");
  });
});
