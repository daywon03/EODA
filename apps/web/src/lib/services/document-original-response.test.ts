import { describe, expect, it } from "vitest";
import { inlineOriginalHeaders, inlineOriginalType } from "./document-original-response";

const PDF = Buffer.from("%PDF-1.7\n%contenu\n", "latin1");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe("inlineOriginalType", () => {
  it("reconnaît un PDF, un JPEG et un PNG par leur signature", () => {
    expect(inlineOriginalType(PDF)).toBe("application/pdf");
    expect(inlineOriginalType(JPEG)).toBe("image/jpeg");
    expect(inlineOriginalType(PNG)).toBe("image/png");
  });

  it("refuse un HTML ou un SVG, quel que soit le nom sous lequel il a été déposé", () => {
    expect(inlineOriginalType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(inlineOriginalType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });
});

describe("inlineOriginalHeaders", () => {
  it("déclare le type détecté, en ligne, sans cache partagé ni devinette de type", () => {
    const headers = inlineOriginalHeaders("image/png", "charte.png");
    expect(headers["Content-Type"]).toBe("image/png");
    expect(headers["Content-Disposition"]).toMatch(/^inline; filename="/);
    expect(headers["Cache-Control"]).toBe("private, no-store");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("un Word part en pièce jointe : le navigateur ne l'affiche jamais lui-même (21/10/2026)", () => {
    const headers = inlineOriginalHeaders(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "livret.docx"
    );
    expect(headers["Content-Disposition"]).toMatch(/^attachment; filename="/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("assainit le nom : aucun guillemet ni retour à la ligne n'atteint l'en-tête", () => {
    const disposition = inlineOriginalHeaders("application/pdf", 'a"b\r\nSet-Cookie: x.pdf')["Content-Disposition"] ?? "";
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(disposition.slice('inline; filename="'.length, -1)).not.toContain('"');
  });
});
