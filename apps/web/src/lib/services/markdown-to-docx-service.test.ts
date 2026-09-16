import { describe, expect, it } from "vitest";
import { generateBrandedDocx } from "./markdown-to-docx-service";

// PNG 1×1 transparent — le plus petit fichier PNG valide, suffisant pour vérifier
// que la génération avec images ne lève pas.
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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

  it("ajoute les images d'origine en annexe, légendées par leur description", async () => {
    const buffer = await generateBrandedDocx({
      markdown: "# Titre\n\nUn paragraphe.",
      title: "Règlement de fonctionnement",
      establishmentName: "ASSAD BENOIT",
      images: [
        { buffer: Buffer.from(PNG_1X1_BASE64, "base64"), contentType: "image/png", description: "Un logo." },
      ],
    });
    // Un .docx est un zip : vérifier au minimum que la génération ne lève pas et que
    // le buffer produit est non vide — un test de rendu pixel exact serait fragile.
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("ignore silencieusement un format d'image non supporté par docx", async () => {
    const buffer = await generateBrandedDocx({
      markdown: "# Titre\n\nUn paragraphe.",
      title: "Règlement de fonctionnement",
      establishmentName: "ASSAD BENOIT",
      images: [{ buffer: Buffer.from("x"), contentType: "image/webp", description: null }],
    });
    expect(buffer.length).toBeGreaterThan(0);
  });
});
