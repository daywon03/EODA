import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildDocumentBody } from "./document-pdf-render-service";

// Le sujet de ce fichier est le CORPS de la page produite : ce qu'on accepte de rendre,
// et ce qu'on refuse. Il ne rend pas de PDF (cela demande Chromium, hors du ressort
// d'un test unitaire) mais il fixe la règle qui compte : le type est décidé par
// SIGNATURE, jamais par l'extension. Un `.docx` qui contient autre chose ne doit pas
// produire des pages vides — il doit produire un refus, que l'appelant traduit en
// « aperçu indisponible ».

async function buildXlsxBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Salariés");
  sheet.addRow(["Fonction", "Effectif"]);
  sheet.addRow(["Coordinateur", 2]);
  sheet.addRow(["<script>alert(1)</script>", 1]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("buildDocumentBody", () => {
  it("rend un CSV comme du TEXTE, sans le réinterpréter en tableau", async () => {
    // Le séparateur peut être `;`, `,` ou une tabulation : un tableau reconstruit se
    // tromperait sur les colonnes.
    const content = Buffer.from(
      "Nom;Fonction\nDupont;Coordinateur\nMartin;Aide-soignant\n",
      "utf8"
    );

    const body = await buildDocumentBody({ originalFilename: "annuaire.csv", content });

    expect(body).not.toBeNull();
    expect(body?.bodyHtml).toContain("<pre");
    expect(body?.bodyHtml).toContain("Dupont;Coordinateur");
    expect(body?.notice).toBeNull();
  });

  it("rend un .xlsx en tableau, une section par feuille, et le dit", async () => {
    const body = await buildDocumentBody({
      originalFilename: "registre.xlsx",
      content: await buildXlsxBuffer(),
    });

    expect(body?.bodyHtml).toContain("<h2>Salariés</h2>");
    expect(body?.bodyHtml).toContain("<td>Coordinateur</td>");
    expect(body?.notice).toContain("mise en forme Excel");
  });

  it("échappe les valeurs des cellules : une cellule n'est jamais du balisage", async () => {
    const body = await buildDocumentBody({
      originalFilename: "registre.xlsx",
      content: await buildXlsxBuffer(),
    });

    expect(body?.bodyHtml).not.toContain("<script>");
    expect(body?.bodyHtml).toContain("&lt;script&gt;");
  });

  it("embarque une image en `data:`, sans rien charger du réseau", async () => {
    const body = await buildDocumentBody({
      originalFilename: "charte.png",
      content: Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from("reste-du-fichier"),
      ]),
    });

    expect(body?.bodyHtml).toContain("data:image/png;base64,");
    expect(body?.notice).toBeNull();
  });

  it("refuse un PDF : il est déjà paginé, le lecteur natif s'en charge", async () => {
    const body = await buildDocumentBody({
      originalFilename: "rapport.pdf",
      content: Buffer.from("%PDF-1.7\n%contenu\n", "latin1"),
    });

    expect(body).toBeNull();
  });

  it("refuse un .doc (OLE2) : aucun convertisseur ne le prend en charge", async () => {
    const body = await buildDocumentBody({
      originalFilename: "ancien.doc",
      content: Buffer.concat([
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        Buffer.from("conteneur-bureautique-ancien"),
      ]),
    });

    expect(body).toBeNull();
  });

  // ── Le cœur de la règle : la SIGNATURE décide, pas le nom ────────────────────
  // Un `.docx` n'est pas produit ici : fabriquer un OOXML valide demanderait d'écrire
  // soi-même une archive Word, et le test vérifierait alors la fixture plutôt que le
  // service. Ce qui doit être prouvé, c'est le refus et la reconnaissance par contenu.

  it("refuse un fichier nommé .docx qui n'en est pas un", async () => {
    // Du texte sans forme de CSV : ni OOXML, ni CSV, donc aucun rendu possible.
    const body = await buildDocumentBody({
      originalFilename: "projet-de-service.docx",
      content: Buffer.from("Ceci n'est pas un document Word.", "utf8"),
    });

    expect(body).toBeNull();
  });

  it("reconnaît un PDF renommé .docx, et le refuse au lieu de rendre une page vide", async () => {
    const body = await buildDocumentBody({
      originalFilename: "projet-de-service.docx",
      content: Buffer.from("%PDF-1.7\n%contenu\n", "latin1"),
    });

    expect(body).toBeNull();
  });

  it("reconnaît un CSV renommé .docx, et le rend en texte", async () => {
    const body = await buildDocumentBody({
      originalFilename: "tableau.docx",
      content: Buffer.from("Nom;Fonction\nDupont;Coordinateur\nMartin;Aide-soignant\n", "utf8"),
    });

    expect(body?.bodyHtml).toContain("Dupont;Coordinateur");
  });
});
