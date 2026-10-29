import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { officeArchiveProblem, validateUploadOnServer } from "./office-archive-guard";

import { buildStoredZip, crc32 } from "@/lib/services/zip-store";

const at = new Date("2026-10-28T10:00:00Z");
const text = (s: string) => new TextEncoder().encode(s);

// Archive à une entrée « deflate ». `declared` : la taille décompressée ANNONCÉE, qui
// peut mentir — le contrôle ne doit pas s'y fier.
function deflatedZip(name: string, content: Uint8Array, declared = content.length): Buffer {
  const data = deflateRawSync(content);
  const nameBytes = text(name);
  const local = Buffer.alloc(30 + nameBytes.length + data.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(content), 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(declared, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.set(nameBytes, 30);
  local.set(data, 30 + nameBytes.length);
  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(declared, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.set(nameBytes, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, end]);
}

describe("officeArchiveProblem — bombe de décompression", () => {
  it("une archive ordinaire passe", () => {
    expect(officeArchiveProblem(deflatedZip("word/document.xml", text("<w:p>".repeat(1000))))).toBeNull();
    expect(officeArchiveProblem(Buffer.from(buildStoredZip([{ name: "word/document.xml", data: text("<w/>"), modifiedAt: at }])))).toBeNull();
  });

  it("refuse ce qui se décompresse au-delà du plafond, même si la taille annoncée ment", () => {
    const bomb = deflatedZip("word/document.xml", new Uint8Array(3 * 1024 * 1024), 10);
    expect(officeArchiveProblem(bomb, { maxUncompressedBytes: 1024 * 1024, maxEntries: 10 })).toMatch(/trop volumineux une fois décompressé/);
  });

  it("refuse trop d'entrées, une archive abîmée, une méthode inconnue", () => {
    const many = Buffer.from(buildStoredZip(Array.from({ length: 4 }, (_, i) => ({ name: `word/${i}.xml`, data: text("x"), modifiedAt: at }))));
    expect(officeArchiveProblem(many, { maxUncompressedBytes: 1024, maxEntries: 3 })).toMatch(/trop volumineux/);
    expect(officeArchiveProblem(Buffer.from("PK\u0003\u0004 word/ rien d'autre"))).toMatch(/abîmé ou piégé/);
    const odd = deflatedZip("word/document.xml", text("abc"));
    odd.writeUInt16LE(12, odd.length - 22 - 46 - "word/document.xml".length + 10);
    expect(officeArchiveProblem(odd)).toMatch(/abîmé ou piégé/);
  });

  it("le dépôt d'un .docx piégé est refusé avant toute analyse", () => {
    const bomb = deflatedZip("word/document.xml", new Uint8Array(201 * 1024 * 1024), 10);
    expect(bomb.length).toBeLessThan(1024 * 1024);
    expect(validateUploadOnServer(bomb, bomb.length)).toEqual({ ok: false, error: expect.stringMatching(/trop volumineux une fois décompressé/) });
  });
});
