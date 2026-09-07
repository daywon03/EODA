import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { XLSX_MIME_TYPE } from "@/lib/security/upload-validation-service";
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

describe("extractMarkdown — XLSX", () => {
  it("rend chaque feuille en tableau Markdown, avec en-tête et séparateur", async () => {
    const buffer = await buildWorkbookBuffer();
    const markdown = await extractMarkdown(buffer, XLSX_MIME_TYPE);

    expect(markdown).not.toBeNull();
    expect(markdown).toContain("## Habilitations");
    expect(markdown).toContain("| Nom | Poste | Habilité |");
    expect(markdown).toContain("| --- | --- | --- |");
    expect(markdown).toContain("| Dupont | Aide à domicile | Oui |");
  });

  it("échappe un caractère `|` présent dans une cellule", async () => {
    const buffer = await buildWorkbookBuffer();
    const markdown = await extractMarkdown(buffer, XLSX_MIME_TYPE);

    // Un `|` non échappé casserait la structure du tableau Markdown.
    expect(markdown).toContain("Coordinateur \\| référent");
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
