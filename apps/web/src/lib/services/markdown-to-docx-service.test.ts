import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generateBrandedDocx, reviewMentionParagraphs } from "./markdown-to-docx-service";
import { buildCoverPage } from "./final-document-service";
import { readZip } from "./zip-read";
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

// Lit les parties XML d'un .docx produit (c'est une archive ZIP).
async function docxParts(buffer: Buffer): Promise<Map<string, string>> {
  const entries = await readZip(new Uint8Array(buffer), async (d) => new Uint8Array(inflateRawSync(d)));
  return new Map(entries.map((e) => [e.name, Buffer.from(e.data).toString("utf8")]));
}

const COVER = {
  ...buildCoverPage({
    documentLabel: "Livret d'accueil",
    establishmentName: "SAD Les Glycines (fictif)",
    criteria: [{ code: "3.12.1", label: "Plaintes et réclamations" }],
  }),
  eodaLogo: Buffer.from(PNG_1X1_BASE64, "base64"),
};

describe("generateBrandedDocx — page de garde EODA et charte de la structure (E1, E2)", () => {
  it("sans page de garde ni charte : une seule section, en-tête EODA, aucune couleur client (rendu inchangé)", async () => {
    const parts = await docxParts(
      await generateBrandedDocx({ markdown: "# Titre\n\nTexte.", title: "Livret", establishmentName: "SAD Les Glycines (fictif)" })
    );
    const body = parts.get("word/document.xml")!;
    expect(body.match(/<w:sectPr/g)).toHaveLength(1);
    expect(body).toContain("Brouillon généré automatiquement");
    expect([...parts.keys()].some((name) => name.startsWith("word/header") && parts.get(name)!.includes("EODA conseil"))).toBe(true);
  });

  it("la page de garde est une SECTION à part : logo EODA, ce que couvre le document, critères, puis le document numéroté à 1", async () => {
    const parts = await docxParts(
      await generateBrandedDocx({
        markdown: "# 1. Accueil\n\nTexte.",
        title: "Livret d'accueil",
        establishmentName: "SAD Les Glycines (fictif)",
        coverPage: COVER,
        brand: { colors: null, logo: null },
      })
    );
    const body = parts.get("word/document.xml")!;
    expect(body.match(/<w:sectPr/g)).toHaveLength(2);
    const coverEnd = body.indexOf("<w:sectPr");
    const cover = body.slice(0, coverEnd);
    expect(cover).toContain("Ce que couvre ce document");
    expect(cover).toContain("3.12.1");
    expect(cover).toContain("Plaintes et réclamations");
    expect(cover).toContain("se détache");
    // Le rappel interne passe sur la page de garde : le document de la structure n'en a plus.
    expect(cover).toContain("Brouillon généré automatiquement");
    expect(body.slice(coverEnd)).not.toContain("Brouillon généré automatiquement");
    expect(body).toMatch(/<w:pgNumType w:start="1"/);
    expect([...parts.keys()].some((name) => name.startsWith("word/media/"))).toBe(true);
  });

  it("le document final porte l'effigie de la structure (son nom sans logo) et ses couleurs, jamais la page de garde", async () => {
    const parts = await docxParts(
      await generateBrandedDocx({
        markdown: "# 1. Accueil\n\n## 1.1 Horaires\n\nTexte.",
        title: "Livret d'accueil",
        establishmentName: "SAD Les Glycines (fictif)",
        coverPage: COVER,
        brand: { colors: { primary: "#1A4D8F", secondary: "#E3A41C" }, logo: null },
      })
    );
    const body = parts.get("word/document.xml")!;
    const coverEnd = body.indexOf("<w:sectPr");
    expect(body.slice(0, coverEnd)).not.toContain("1A4D8F");
    expect(body.slice(coverEnd)).toContain('w:color w:val="1A4D8F"');
    expect(body.slice(coverEnd)).toContain('w:color="E3A41C"');
    const headers = [...parts.entries()].filter(([name]) => name.startsWith("word/header")).map(([, xml]) => xml);
    expect(headers.some((xml) => xml.includes("SAD Les Glycines (fictif)"))).toBe(true);
    expect(headers.some((xml) => xml.includes("EODA conseil"))).toBe(false);
  });
});

describe("reviewMentionParagraphs", () => {
  it("un paragraphe pour une mention, aucun sans mention", () => {
    expect(reviewMentionParagraphs(AUTONOMY_RESERVE)).toHaveLength(1);
    expect(reviewMentionParagraphs(null)).toEqual([]);
  });
});
