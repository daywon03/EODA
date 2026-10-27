import { describe, expect, it } from "vitest";
import { buildStoredZip, crc32, uniqueNames } from "./zip-store";
import { readXlsxRows } from "./xlsx-rows-reader";

const text = (value: string) => new TextEncoder().encode(value);
const at = new Date(2026, 9, 26, 14, 30, 10);

function u32(b: Uint8Array, i: number): number {
  return (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
}

describe("crc32", () => {
  it("donne la valeur de référence du standard", () => {
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("uniqueNames", () => {
  it("ne laisse jamais deux fichiers porter le même nom", () => {
    expect(uniqueNames(["a.pdf", "b.pdf", "a.pdf", "a.pdf", "index"])).toEqual(["a.pdf", "b.pdf", "a (2).pdf", "a (3).pdf", "index"]);
  });
});

describe("buildStoredZip", () => {
  it("écrit en-têtes locaux, répertoire central et fin d'archive cohérents", () => {
    const zip = buildStoredZip([
      { name: "un.txt", data: text("bonjour"), modifiedAt: at },
      { name: "deux é.txt", data: text("x"), modifiedAt: at },
    ]);
    expect(u32(zip, 0)).toBe(0x04034b50);
    const eocd = zip.length - 22;
    expect(u32(zip, eocd)).toBe(0x06054b50);
    expect(zip[eocd + 10]).toBe(2);
    const centralOffset = u32(zip, eocd + 16);
    expect(u32(zip, centralOffset)).toBe(0x02014b50);
    // Le CRC du premier fichier est celui de son contenu.
    expect(u32(zip, 14)).toBe(crc32(text("bonjour")));
  });

  it("retire un chemin qui sortirait du dossier d'extraction", () => {
    const zip = buildStoredZip([{ name: "../../etc/x.pdf", data: text("x"), modifiedAt: at }]);
    const nameLength = zip[26]! | (zip[27]! << 8);
    expect(new TextDecoder().decode(zip.subarray(30, 30 + nameLength))).toBe("etc/x.pdf");
  });

  it("se relit : un classeur aux balises préfixées (forme Ximi) passe par le lecteur de la tablette", async () => {
    const workbook =
      '<?xml version="1.0"?><x:workbook xmlns:x="m" xmlns:r="r"><x:sheets><x:sheet name="A" sheetId="1" r:id="rId1" /></x:sheets></x:workbook>';
    const rels =
      '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml" Type="w" /></Relationships>';
    const shared = '<x:sst><x:si><x:t>Nom</x:t></x:si><x:si><x:t>DURAND, Paul</x:t></x:si></x:sst>';
    const sheet = '<x:worksheet><x:sheetData><x:row r="1"><x:c r="A1" t="s"><x:v>0</x:v></x:c></x:row><x:row r="2"><x:c r="A2" t="s"><x:v>1</x:v></x:c></x:row></x:sheetData></x:worksheet>';
    const zip = buildStoredZip([
      { name: "xl/workbook.xml", data: text(workbook), modifiedAt: at },
      { name: "xl/_rels/workbook.xml.rels", data: text(rels), modifiedAt: at },
      { name: "xl/sharedStrings.xml", data: text(shared), modifiedAt: at },
      { name: "xl/worksheets/sheet1.xml", data: text(sheet), modifiedAt: at },
    ]);
    expect(await readXlsxRows(zip)).toEqual([["Nom"], ["DURAND, Paul"]]);
  });
});
