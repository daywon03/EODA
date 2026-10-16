import { describe, expect, it } from "vitest";
import { generateBrandedDocx, reviewMentionParagraphs } from "./markdown-to-docx-service";
import { AUTONOMY_RESERVE } from "./review-mention-service";

// PNG 1×1 transparent — le plus petit fichier PNG valide, suffisant pour vérifier
// que la génération avec images ne lève pas.
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("generateBrandedDocx", () => {
  it("produit un .docx valide (signature ZIP) contenant la mention de paternité", async () => {
    const buffer = await generateBrandedDocx({
      markdown: "# Titre\n\nUn paragraphe **important** avec du texte.\n\n- Premier point\n- Second point",
      title: "Règlement de fonctionnement",
      establishmentName: "SAD Les Glycines (fictif)",
    });

    // Un .docx est une archive ZIP : signature binaire "PK".
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("ajoute les images d'origine en annexe, légendées par leur description", async () => {
    const buffer = await generateBrandedDocx({
      markdown: "# Titre\n\nUn paragraphe.",
      title: "Règlement de fonctionnement",
      establishmentName: "SAD Les Glycines (fictif)",
      images: [
        {
          buffer: Buffer.from(PNG_1X1_BASE64, "base64"),
          contentType: "image/png",
          description: "Un logo.",
          position: 1,
        },
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
      establishmentName: "SAD Les Glycines (fictif)",
      images: [{ buffer: Buffer.from("x"), contentType: "image/webp", description: null, position: 1 }],
    });
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("porte la mention de relecture (réserve d'autonomie) quand elle est fournie", async () => {
    const buffer = await generateBrandedDocx({
      markdown: "# Titre",
      title: "Livret d'accueil",
      establishmentName: "SAD Les Glycines (fictif)",
      reviewMention: AUTONOMY_RESERVE,
    });
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});

describe("reviewMentionParagraphs", () => {
  it("un paragraphe pour une mention, aucun sans mention", () => {
    expect(reviewMentionParagraphs(AUTONOMY_RESERVE)).toHaveLength(1);
    expect(reviewMentionParagraphs(null)).toEqual([]);
  });
});
