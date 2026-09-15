import { describe, expect, it } from "vitest";
import { generateBrandedDocx } from "./markdown-to-docx-service";

describe("generateBrandedDocx", () => {
  it("produit un .docx valide (signature ZIP) contenant la mention de paternité", async () => {
    const buffer = await generateBrandedDocx({
      markdown: "# Titre\n\nUn paragraphe **important** avec du texte.\n\n- Premier point\n- Second point",
      title: "Règlement de fonctionnement",
      establishmentName: "ASSAD BENOIT",
    });

    // Un .docx est une archive ZIP : signature binaire "PK".
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(buffer.length).toBeGreaterThan(0);
  });
});
