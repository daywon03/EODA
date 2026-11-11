import { describe, expect, it, vi } from "vitest";
import { inflateRawSync } from "node:zlib";
import { buildStoredZip } from "./zip-store";
import { buildFinalDocx } from "./final-docx-builder";

// Le document final garde le design du client (11/11/2026) : son Word d'origine
// d'abord, sinon le modèle de mise en page de la structure, sinon le rendu EODA.

const enc = (s: string) => new TextEncoder().encode(s);
const wordFile = (marker: string) =>
  Buffer.from(
    buildStoredZip([
      {
        name: "word/document.xml",
        data: enc(`<w:document xmlns:w="w"><w:body><w:p><w:r><w:t>${marker}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`),
        modifiedAt: new Date(2026, 0, 1),
      },
      { name: "word/styles.xml", data: enc("<w:styles/>"), modifiedAt: new Date(2026, 0, 1) },
    ])
  );
const inflate = async (data: Uint8Array) => new Uint8Array(inflateRawSync(data));
const transplant = { markdown: "Texte final.", cover: null, reviewMention: null };

describe("buildFinalDocx", () => {
  it("le Word d'origine du client d'abord", async () => {
    const storage = { download: vi.fn().mockResolvedValue(wordFile("origine")) };
    const branded = vi.fn();
    const result = await buildFinalDocx({
      candidates: [{ key: "src.docx", source: "SOURCE" }, { key: "model.docx", source: "STRUCTURE_MODEL" }],
      storage,
      inflateRaw: inflate,
      transplant,
      branded,
    });
    expect(result.design).toBe("SOURCE");
    expect(storage.download).toHaveBeenCalledTimes(1);
    expect(branded).not.toHaveBeenCalled();
  });

  it("original illisible (PDF, fichier abîmé) : le modèle de la structure", async () => {
    const storage = {
      download: vi.fn().mockResolvedValueOnce(Buffer.from("%PDF-1.7")).mockResolvedValueOnce(wordFile("modèle")),
    };
    const result = await buildFinalDocx({
      candidates: [{ key: "src.pdf", source: "SOURCE" }, { key: "model.docx", source: "STRUCTURE_MODEL" }],
      storage,
      inflateRaw: inflate,
      transplant,
      branded: vi.fn(),
    });
    expect(result.design).toBe("STRUCTURE_MODEL");
  });

  it("aucun Word utilisable : le rendu EODA, jamais un échec", async () => {
    const storage = { download: vi.fn().mockRejectedValue(new Error("absent")) };
    const branded = vi.fn().mockResolvedValue(Buffer.from("branded"));
    const result = await buildFinalDocx({
      candidates: [{ key: "x", source: "SOURCE" }],
      storage,
      inflateRaw: inflate,
      transplant,
      branded,
    });
    expect(result).toEqual({ docx: Buffer.from("branded"), design: "BRANDED" });
  });
});
