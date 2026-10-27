import { deflateRawSync, inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { isZip, readZip, ZipReadError, type InflateRaw } from "./zip-read";
import { buildStoredZip, crc32 } from "./zip-store";

const inflate: InflateRaw = async (data) => new Uint8Array(inflateRawSync(data));
const text = (s: string) => new TextEncoder().encode(s);
const at = new Date("2026-10-27T10:00:00Z");

// Une archive à une entrée « deflate » (méthode 8), comme celles que fabrique Word.
function deflatedZip(name: string, content: Uint8Array): Uint8Array {
  const data = new Uint8Array(deflateRawSync(content));
  const nameBytes = text(name);
  const local = new Uint8Array(30 + nameBytes.length + data.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(8, 8, true);
  lv.setUint32(14, crc32(content), true);
  lv.setUint32(18, data.length, true);
  lv.setUint32(22, content.length, true);
  lv.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  local.set(data, 30 + nameBytes.length);
  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(20, data.length, true);
  cv.setUint32(24, content.length, true);
  cv.setUint16(28, nameBytes.length, true);
  central.set(nameBytes, 46);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);
  const out = new Uint8Array(local.length + central.length + end.length);
  out.set(local, 0);
  out.set(central, local.length);
  out.set(end, local.length + central.length);
  return out;
}

describe("readZip", () => {
  it("relit une archive stockée (aller-retour avec buildStoredZip)", async () => {
    const zip = buildStoredZip([
      { name: "[Content_Types].xml", data: text("<Types/>"), modifiedAt: at },
      { name: "word/document.xml", data: text("<w:document>é</w:document>"), modifiedAt: at },
    ]);
    expect(isZip(zip)).toBe(true);
    const entries = await readZip(zip, inflate);
    expect(entries.map((e) => e.name)).toEqual(["[Content_Types].xml", "word/document.xml"]);
    expect(new TextDecoder().decode(entries[1]!.data)).toBe("<w:document>é</w:document>");
  });

  it("décompresse une entrée deflate", async () => {
    const content = text("<w:p>".repeat(200));
    const [entry] = await readZip(deflatedZip("word/document.xml", content), inflate);
    expect(entry).toEqual({ name: "word/document.xml", data: content });
  });

  it("refuse ce qui n'est pas une archive, ou une archive abîmée", async () => {
    expect(isZip(text("%PDF-1.7"))).toBe(false);
    await expect(readZip(text("pas une archive du tout, vraiment pas"), inflate)).rejects.toBeInstanceOf(ZipReadError);
    const zip = deflatedZip("a.xml", text("abc"));
    const broken = zip.slice();
    new DataView(broken.buffer).setUint16(8, 12, true); // méthode inconnue (local)
    new DataView(broken.buffer).setUint16(zip.length - 22 - 46 - 5 + 10, 12, true); // et répertoire
    await expect(readZip(broken, inflate)).rejects.toThrow(/Méthode de compression inconnue/);
    // Début coupé : les entrées ne sont plus où le répertoire les situe.
    await expect(readZip(zip.slice(25), inflate)).rejects.toBeInstanceOf(ZipReadError);
  });
});
