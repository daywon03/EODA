import { describe, expect, it } from "vitest";
import { decodeLogoDataUri, establishmentLogoUrl } from "./logo-response-service";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe("decodeLogoDataUri", () => {
  it("décode un PNG reconnu par sa signature", () => {
    const decoded = decodeLogoDataUri(`data:image/png;base64,${PNG.toString("base64")}`);
    expect(decoded?.type).toBe("image/png");
    expect(decoded?.bytes.equals(PNG)).toBe(true);
  });

  it("refuse une URI qui ment sur son contenu", () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>").toString("base64");
    expect(decodeLogoDataUri(`data:image/png;base64,${html}`)).toBeNull();
  });

  it("refuse un SVG, une URI mal formée ou l'absence de logo", () => {
    expect(decodeLogoDataUri("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(decodeLogoDataUri("pas une uri")).toBeNull();
    expect(decodeLogoDataUri(null)).toBeNull();
  });
});

describe("establishmentLogoUrl", () => {
  it("échappe l'identifiant", () => {
    expect(establishmentLogoUrl("a/b")).toBe("/api/establishments/a%2Fb/logo");
  });
});
