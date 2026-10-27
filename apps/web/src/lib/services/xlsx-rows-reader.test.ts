import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { XlsxReadError, columnIndex, decodeXml, parseSharedStrings, parseSheetRows, readXlsxRows, withoutTagPrefixes } from "./xlsx-rows-reader";

async function workbookBytes(build: (wb: ExcelJS.Workbook) => void): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

describe("readXlsxRows", () => {
  it("lit la première feuille d'un vrai .xlsx (texte, nombres, cellules vides)", async () => {
    const bytes = await workbookBytes((wb) => {
      const sheet = wb.addWorksheet("Bénéficiaires");
      sheet.addRow(["Code", "Nom", "Prénom", "GIR"]);
      sheet.addRow([1, "Durand", "Hélène & fils", 3]);
      sheet.getCell("B3").value = "Petit";
      sheet.getCell("D3").value = 4;
      wb.addWorksheet("Autre").addRow(["ne pas lire"]);
    });
    const rows = await readXlsxRows(bytes);
    expect(rows).toEqual([
      ["Code", "Nom", "Prénom", "GIR"],
      ["1", "Durand", "Hélène & fils", "3"],
      ["", "Petit", "", "4"],
    ]);
  });

  it("refuse ce qui n'est pas un .xlsx", async () => {
    await expect(readXlsxRows(new TextEncoder().encode("Nom;Prénom"))).rejects.toBeInstanceOf(XlsxReadError);
    await expect(readXlsxRows(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]))).rejects.toBeInstanceOf(XlsxReadError);
  });

  it("refuse un fichier trop gros avant de le lire", async () => {
    await expect(readXlsxRows(new Uint8Array(5_000_001))).rejects.toThrow(/trop gros/);
  });
});

describe("morceaux XML", () => {
  it("décode les entités", () => {
    expect(decodeXml("&lt;a&gt; &amp;amp; &quot;&apos; &#233;&#x00E8;")).toBe("<a> &amp; \"' éè");
  });

  it("chaînes partagées : texte enrichi concaténé, phonétique ignorée", () => {
    expect(parseSharedStrings('<sst><si><t>Nom</t></si><si><r><t>Hé</t></r><r><t xml:space="preserve">lène</t></r><rPh><t>x</t></rPh></si><si/></sst>')).toEqual(["Nom", "Hélène", ""]);
  });

  it("colonnes et cellules en ligne", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("AB12")).toBe(27);
    const xml = '<sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>Paul</t></is></c><c r="D1" s="1"/></row><row r="2"><c r="ZZ2"><v>9</v></c></row></sheetData>';
    expect(parseSheetRows(xml, ["Durand"])).toEqual([["Durand", "", "Paul", ""], []]);
  });

  // Forme mesurée sur l'export « Clients » de Ximi (SDK OpenXML, 26/10/2026) : toutes
  // les balises préfixées `x:`. Sans retrait du préfixe, zéro ligne était lue.
  it("lit un classeur aux balises préfixées (export Ximi)", () => {
    expect(withoutTagPrefixes('<x:sheet name="A" r:id="rId1" /></x:sheets>')).toBe('<sheet name="A" r:id="rId1" /></sheets>');
    expect(parseSharedStrings('<x:sst xmlns:x="urn"><x:si><x:t>DURAND, Paul</x:t></x:si><x:si><x:t>Nom</x:t></x:si></x:sst>')).toEqual(["DURAND, Paul", "Nom"]);
    const xml = '<x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>1</x:v></x:c></x:row><x:row r="2"><x:c r="A2" t="s"><x:v>0</x:v></x:c><x:c r="B2"><x:v>93000</x:v></x:c></x:row></x:sheetData>';
    expect(parseSheetRows(xml, ["DURAND, Paul", "Nom"])).toEqual([["Nom"], ["DURAND, Paul", "93000"]]);
  });
});
