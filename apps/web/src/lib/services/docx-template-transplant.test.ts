import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { buildStoredZip } from "./zip-store";
import { readZip } from "./zip-read";
import {
  markdownToWordXml,
  readTemplateStyles,
  replaceBody,
  transplantIntoTemplate,
  describeDocxDesign,
  summarizeDocxDesign,
  type TemplateStyles,
} from "./docx-template-transplant";

// Retour de Damon (11/11/2026) : « pour la mise en conformité le problème est qu'il ne
// garde pas le design des documents, il modifie tout ». Le document final reprend
// désormais le Word du CLIENT (styles, en-têtes, pieds, logo, marges) et n'y remplace
// que le corps.

const STYLES = `<?xml version="1.0"?><w:styles xmlns:w="w">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/></w:style>
<w:style w:type="paragraph" w:styleId="Titre2"><w:name w:val="heading 2"/></w:style>
<w:style w:type="paragraph" w:styleId="Titre"><w:name w:val="Title"/></w:style>
<w:style w:type="paragraph" w:styleId="Paragraphedeliste"><w:name w:val="List Paragraph"/></w:style>
<w:style w:type="table" w:styleId="Grilledutableau"><w:name w:val="Table Grid"/></w:style>
</w:styles>`;

const SECT = `<w:sectPr><w:headerReference w:type="default" r:id="rId9"/><w:footerReference w:type="default" r:id="rId10"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417"/></w:sectPr>`;
const DOCUMENT = `<?xml version="1.0"?><w:document xmlns:w="w" xmlns:r="r"><w:body><w:p><w:r><w:t>Ancien corps</w:t></w:r></w:p>${SECT}</w:body></w:document>`;

const STYLES_MAP: TemplateStyles = {
  title: "Titre",
  headings: ["Titre1", "Titre2", null],
  body: "Normal",
  list: { id: "Paragraphedeliste", bulleted: false },
  table: "Grilledutableau",
};

describe("readTemplateStyles — les styles du Word du client", () => {
  it("retrouve titres, corps, liste et tableau par leur nom interne, quelle que soit la langue de Word", () => {
    expect(readTemplateStyles(STYLES)).toEqual(STYLES_MAP);
  });

  it("styles absents : null, jamais un nom inventé", () => {
    expect(readTemplateStyles(`<w:styles xmlns:w="w"></w:styles>`)).toEqual({
      title: null,
      headings: [null, null, null],
      body: null,
      list: null,
      table: null,
    });
  });
});

describe("markdownToWordXml — le texte dans les styles du client", () => {
  it("titres, paragraphes, gras et italique avec les styles du modèle", () => {
    const xml = markdownToWordXml("# Objet\n\nLe **plan** est *révisé* chaque année.", STYLES_MAP);
    expect(xml).toContain('<w:pStyle w:val="Titre1"/>');
    expect(xml).toContain("<w:t xml:space=\"preserve\">Objet</w:t>");
    expect(xml).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">plan</w:t>');
    expect(xml).toContain('<w:rPr><w:i/></w:rPr><w:t xml:space="preserve">révisé</w:t>');
    expect(xml).toContain('<w:pStyle w:val="Normal"/>');
  });

  it("liste à puces dans le style de liste du client ; puce écrite si ce style n'en a pas", () => {
    const xml = markdownToWordXml("- un\n- deux", STYLES_MAP);
    expect(xml).toContain('<w:pStyle w:val="Paragraphedeliste"/>');
    expect(xml).toContain(">• un</w:t>");
    const bulleted = markdownToWordXml("- un", { ...STYLES_MAP, list: { id: "Listepuces", bulleted: true } });
    expect(bulleted).toContain('<w:pStyle w:val="Listepuces"/>');
    expect(bulleted).toContain(">un</w:t>");
  });

  it("préfère le style « List Bullet » (puce intégrée) à « List Paragraph »", () => {
    const styles = readTemplateStyles(
      STYLES.replace("</w:styles>", '<w:style w:type="paragraph" w:styleId="Listepuces"><w:name w:val="List Bullet"/></w:style></w:styles>')
    );
    expect(styles.list).toEqual({ id: "Listepuces", bulleted: true });
  });

  it("tableau markdown → tableau Word dans le style de tableau du client", () => {
    const xml = markdownToWordXml("| Champ | Valeur |\n|---|---|\n| Version | 1.1 |", STYLES_MAP);
    expect(xml).toContain('<w:tblStyle w:val="Grilledutableau"/>');
    expect((xml.match(/<w:tr>/g) ?? []).length).toBe(2);
    expect(xml).not.toContain("---");
  });

  it("échappe le XML : un texte ne casse jamais le document", () => {
    expect(markdownToWordXml("A & B < C > D \"E\"", STYLES_MAP)).toContain("A &amp; B &lt; C &gt; D &quot;E&quot;");
  });

  it("sans style de titre 3 : retombe sur le titre 2, jamais un style inexistant", () => {
    expect(markdownToWordXml("### Détail", STYLES_MAP)).toContain('<w:pStyle w:val="Titre2"/>');
  });
});

describe("replaceBody — le corps change, la mise en page reste", () => {
  it("garde la sectPr finale (en-têtes, pieds, marges, format)", () => {
    const next = replaceBody(DOCUMENT, "<w:p><w:r><w:t>Nouveau</w:t></w:r></w:p>");
    expect(next).not.toContain("Ancien corps");
    expect(next).toContain("Nouveau");
    expect(next).toContain(SECT);
    expect(next.indexOf("Nouveau")).toBeLessThan(next.indexOf("<w:sectPr>"));
  });

  it("refuse un document sans corps lisible plutôt que d'écrire à côté", () => {
    expect(() => replaceBody("<w:document/>", "<w:p/>")).toThrow();
  });
});

describe("describeDocxDesign — ce que l'assistant comprend de la mise en page d'un client", () => {
  it("police, tailles, couleur des titres, en-tête et logo, format et marges", () => {
    const design = describeDocxDesign([
      {
        name: "word/styles.xml",
        data: new TextEncoder().encode(
          `<w:styles><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>` +
            `<w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/><w:rPr><w:rFonts w:ascii="Georgia"/><w:color w:val="1F6E43"/><w:sz w:val="32"/></w:rPr></w:style></w:styles>`
        ),
      },
      { name: "word/header1.xml", data: new TextEncoder().encode("<w:hdr><w:p><w:r><w:t>Association Exemple</w:t></w:r><w:r><w:drawing/></w:r></w:p></w:hdr>") },
      { name: "word/footer1.xml", data: new TextEncoder().encode("<w:ftr><w:p><w:r><w:t>Page</w:t></w:r></w:p></w:ftr>") },
      { name: "word/document.xml", data: new TextEncoder().encode(DOCUMENT) },
    ]);
    expect(design).toEqual({
      bodyFont: "Calibri",
      bodySizePt: 11,
      headingFont: "Georgia",
      headingColor: "#1F6E43",
      headingSizePt: 16,
      headerTexts: ["Association Exemple"],
      footerTexts: ["Page"],
      headerHasImage: true,
      pageSize: "A4 portrait",
      marginsCm: { top: 2.5 },
    });
    expect(summarizeDocxDesign(design)).toContain("titres en Georgia 16 pt, couleur #1F6E43");
  });
});

describe("transplantIntoTemplate — le Word complet", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const template = buildStoredZip([
    { name: "[Content_Types].xml", data: enc("<Types/>"), modifiedAt: new Date(2026, 0, 1) },
    { name: "word/document.xml", data: enc(DOCUMENT), modifiedAt: new Date(2026, 0, 1) },
    { name: "word/styles.xml", data: enc(STYLES), modifiedAt: new Date(2026, 0, 1) },
    { name: "word/header1.xml", data: enc("<w:hdr>LOGO STRUCTURE FICTIVE</w:hdr>"), modifiedAt: new Date(2026, 0, 1) },
  ]);
  const inflate = async (data: Uint8Array) => new Uint8Array(inflateRawSync(data));

  it("réécrit le corps, garde styles, en-tête et page ; ajoute la page de garde EODA en section à part et la mention", async () => {
    const out = await transplantIntoTemplate(template, inflate, {
      markdown: "# Objet\n\nTexte corrigé.",
      cover: {
        title: "Plan de crise",
        coverageHeading: "Ce que couvre ce document",
        coverageText: "Ce document répond à 1 critère :",
        criteria: [{ code: "3.14.2", label: "Crise" }],
        detachNote: "Page de suivi EODA : elle se détache.",
        ownershipMention: "Créé par EODA.",
      },
      reviewMention: "Non revérifié par un humain : peut comporter des erreurs. À relire absolument.",
    });
    const entries = await readZip(out, inflate);
    const text = (name: string) => new TextDecoder().decode(entries.find((e) => e.name === name)!.data);
    const doc = text("word/document.xml");
    expect(text("word/styles.xml")).toBe(STYLES);
    expect(text("word/header1.xml")).toBe("<w:hdr>LOGO STRUCTURE FICTIVE</w:hdr>");
    expect(doc).toContain("Texte corrigé.");
    expect(doc).not.toContain("Ancien corps");
    expect(doc).toContain(SECT);
    // Page de garde : avant le document, close par sa propre section SANS en-tête du client.
    expect(doc.indexOf("Plan de crise")).toBeLessThan(doc.indexOf("Texte corrigé."));
    expect(doc).toMatch(/<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"\/><w:pgMar w:top="1417"\/><\/w:sectPr><\/w:pPr><\/w:p>/);
    expect(doc).toContain("3.14.2");
    expect(doc).toContain("À relire absolument.");
  });
});
