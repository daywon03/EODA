import ExcelJS from "exceljs";

// Première feuille d'un classeur .xlsx, réduite en texte cellule par cellule (index
// 0 = colonne A). Le fichier vient d'un dépôt : son type a déjà été vérifié par
// signature par l'appelant ; une lecture qui échoue rend null, jamais une exception.
export async function readFirstSheetAsText(content: Buffer): Promise<string[][] | null> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return null;
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        cells[column - 1] = cell.text ?? "";
      });
      rows.push(Array.from(cells, (c) => c ?? ""));
    });
    return rows;
  } catch {
    return null;
  }
}
