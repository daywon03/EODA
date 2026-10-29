import { describe, expect, it } from "vitest";
import { csvCell } from "./csv-cell";
import { escapeCsvValue } from "./evaluation-export-service";

describe("csvCell — une règle pour tous les exports", () => {
  it("neutralise les formules et échappe le CSV « ; »", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+33 6")).toBe("'+33 6");
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(3)).toBe("3");
  });

  it("l'export des cotations la suit enfin (audit du 28/10/2026)", () => {
    expect(escapeCsvValue("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvValue("Commentaire ; ligne")).toBe('"Commentaire ; ligne"');
  });
});
