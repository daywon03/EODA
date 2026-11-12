import { describe, expect, it } from "vitest";
import {
  cardSignatureOffer,
  classifySignatureLabel,
  defaultZoneMarks,
  findPdfSignatureZones,
  fitInRect,
  groupPdfLines,
  manualPdfZone,
  matchRenderedParagraph,
  normalizeLine,
  signableKind,
  signedFilename,
  signingRefusal,
} from "./document-signature-service";
import { findWordSignatureZones, firstFreeMarkNumber, planWordMarks, signWordPackage } from "./document-signature-word";
import { readZip } from "./zip-read";

const PNG_1x1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 200, 0, 0, 0, 100, 8, 6, 0, 0, 0,
]);

const p = (text: string, style = "") =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const doc = (...paragraphs: string[]) =>
  `<w:document><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz/></w:sectPr></w:body></w:document>`;

describe("classifySignatureLabel — repérer une case par son libellé", () => {
  it.each([
    ["Signature :", "SIGNATURE"],
    ["Le directeur", "SIGNATURE"],
    ["La directrice, Mme Exemple", "SIGNATURE"],
    ["Pour la structure", "SIGNATURE"],
    ["Lu et approuvé", "SIGNATURE"],
    ["Visa de la direction", "SIGNATURE"],
    ["Cachet de la structure", "TAMPON"],
    ["Signature et tampon", "TAMPON"],
  ])("« %s » → %s", (text, kind) => {
    expect(classifySignatureLabel(text)).toBe(kind);
  });

  it("ignore une phrase du corps qui parle de signature", () => {
    expect(
      classifySignatureLabel(
        "La signature du contrat intervient après la remise du livret d'accueil et l'explication de chacun de ses articles à la personne."
      )
    ).toBeNull();
    expect(classifySignatureLabel("Objet de la procédure")).toBeNull();
    expect(classifySignatureLabel("")).toBeNull();
  });
});

describe("findWordSignatureZones", () => {
  it("trouve les cases dans l'ordre, sans les titres ni le sommaire", () => {
    const xml = doc(
      p("Article 9 – Signature", "Titre2"),
      p("Signature", "TM1"),
      p("Le présent document est validé."),
      p("Le directeur"),
      p("Cachet de la structure")
    );
    const zones = findWordSignatureZones(xml);
    expect(zones.map((z) => [z.kind, z.label])).toEqual([
      ["SIGNATURE", "Le directeur"],
      ["TAMPON", "Cachet de la structure"],
    ]);
    expect(zones[0]!.paragraph).toBe(3);
  });
});

describe("planWordMarks — poser les images", () => {
  it("pose l'image juste APRÈS le paragraphe de la case, sans toucher au reste", () => {
    const xml = doc(p("Avant"), p("Le directeur"), p("Après"));
    const out = planWordMarks(xml, [{ paragraph: 1, mark: "SIGNATURE", png: PNG_1x1 }]);
    const directeur = out.documentXml.indexOf("Le directeur");
    const drawing = out.documentXml.indexOf("<w:drawing>");
    const apres = out.documentXml.indexOf("Après");
    expect(directeur).toBeLessThan(drawing);
    expect(drawing).toBeLessThan(apres);
    expect(out.images).toHaveLength(1);
    expect(out.images[0]!.relId).toBe("rIdEodaMarque1");
  });

  it("sans case : en fin de document, avant les propriétés de section", () => {
    const xml = doc(p("Texte"));
    const out = planWordMarks(xml, [{ paragraph: null, mark: "TAMPON", png: PNG_1x1 }]);
    expect(out.documentXml.indexOf("<w:drawing>")).toBeLessThan(out.documentXml.indexOf("<w:sectPr"));
    expect(out.documentXml.indexOf("<w:drawing>")).toBeGreaterThan(out.documentXml.indexOf("Texte"));
  });

  it("donne des identifiants de dessin uniques, au-delà de ceux du document", () => {
    const xml = doc(p("Le directeur"), '<w:p><wp:docPr id="1500" name="x"/></w:p>', p("Cachet"));
    const out = planWordMarks(xml, [
      { paragraph: 0, mark: "SIGNATURE", png: PNG_1x1 },
      { paragraph: 2, mark: "TAMPON", png: PNG_1x1 },
    ]);
    const ids = [...out.documentXml.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => Number(m[1]));
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids.filter((id) => id !== 1500))).toBeGreaterThan(1500);
  });

  it("le tampon est posé plus grand que la signature", () => {
    const xml = doc(p("Le directeur"), p("Cachet"));
    const out = planWordMarks(xml, [
      { paragraph: 0, mark: "SIGNATURE", png: PNG_1x1 },
      { paragraph: 1, mark: "TAMPON", png: PNG_1x1 },
    ]);
    const heights = [...out.documentXml.matchAll(/<wp:extent cx="\d+" cy="(\d+)"/g)].map((m) => Number(m[1]));
    expect(heights[1]).toBeGreaterThan(heights[0]!);
  });
});

describe("signWordPackage — une archive Word valide", () => {
  it("ajoute l'image, sa relation et le type png, sans collision avec une signature précédente", async () => {
    const enc = new TextEncoder();
    const entries = [
      { name: "[Content_Types].xml", data: enc.encode('<Types xmlns="x"></Types>') },
      { name: "word/document.xml", data: enc.encode(doc(p("Le directeur"))) },
      { name: "word/_rels/document.xml.rels", data: enc.encode("<Relationships></Relationships>") },
      { name: "word/media/eoda-marque-1.png", data: PNG_1x1 },
    ];
    const bytes = signWordPackage(
      { entries, documentXml: doc(p("Le directeur")) },
      [{ paragraph: 0, mark: "SIGNATURE", png: PNG_1x1 }],
      new Date("2026-11-12T10:00:00Z")
    );
    const read = await readZip(bytes, async (d) => d);
    const names = read.map((e) => e.name);
    expect(names).toContain("word/media/eoda-marque-2.png");
    expect(new Set(names).size).toBe(names.length);
    const dec = new TextDecoder();
    expect(dec.decode(read.find((e) => e.name === "word/_rels/document.xml.rels")!.data)).toContain('Target="media/eoda-marque-2.png"');
    expect(dec.decode(read.find((e) => e.name === "[Content_Types].xml")!.data)).toContain('Extension="png"');
  });

  it("firstFreeMarkNumber", () => {
    expect(firstFreeMarkNumber(["word/document.xml"])).toBe(1);
    expect(firstFreeMarkNumber(["word/media/eoda-marque-3.png", "word/media/eoda-marque-1.png"])).toBe(4);
  });
});

describe("PDF — cases sous leur libellé", () => {
  const page = {
    page: 2,
    width: 595,
    height: 842,
    items: [
      { text: "Le", x: 60, y: 200, width: 12, height: 11 },
      { text: "directeur", x: 75, y: 200.8, width: 50, height: 11 },
      { text: "Cachet de la structure", x: 320, y: 200, width: 120, height: 11 },
      { text: "Corps du texte sans case", x: 60, y: 500, width: 200, height: 11 },
    ],
  };

  it("recolle les morceaux d'une même ligne", () => {
    expect(groupPdfLines(page.items).map((l) => l.text)).toContain("Le directeur");
  });

  it("place la case sous le libellé, dans la page", () => {
    const zones = findPdfSignatureZones([page]);
    expect(zones.map((z) => [z.kind, z.label, z.page])).toEqual([
      ["SIGNATURE", "Le directeur", 2],
      ["TAMPON", "Cachet de la structure", 2],
    ]);
    const sig = zones[0]!.rect;
    expect(sig.y + sig.height).toBeLessThan(200);
    expect(sig.x).toBe(60);
  });

  it("une case près du bas reste dans la page", () => {
    const zones = findPdfSignatureZones([{ ...page, items: [{ text: "Signature :", x: 560, y: 20, width: 40, height: 11 }] }]);
    const r = zones[0]!.rect;
    expect(r.y).toBeGreaterThanOrEqual(8);
    expect(r.x + r.width).toBeLessThanOrEqual(595 - 8);
  });

  it("une case placée à la main est centrée sur le clic (repère écran : haut à gauche)", () => {
    const zone = manualPdfZone({ id: "m1", page: 1, pageWidth: 600, pageHeight: 800, fx: 0.5, fy: 0.25, kind: "SIGNATURE" });
    expect(zone.rect.x + zone.rect.width / 2).toBeCloseTo(300);
    expect(zone.rect.y + zone.rect.height / 2).toBeCloseTo(600);
  });

  it("fitInRect garde les proportions et centre", () => {
    const r = fitInRect({ width: 200, height: 100 }, { x: 0, y: 0, width: 100, height: 100 });
    expect(r).toEqual({ x: 0, y: 25, width: 100, height: 50 });
  });
});

describe("defaultZoneMarks", () => {
  it("une signature et un tampon, dans les premières cases de chaque sorte", () => {
    expect(
      defaultZoneMarks([
        { id: "a", kind: "SIGNATURE" },
        { id: "b", kind: "SIGNATURE" },
        { id: "c", kind: "TAMPON" },
      ])
    ).toEqual({ a: "SIGNATURE", b: null, c: "TAMPON" });
  });
});

describe("signingRefusal — qui signe quoi", () => {
  const ok = {
    accessRole: "DIRECTION" as const,
    canWrite: true,
    documentTypeCode: "LOI_LIVRET_ACCUEIL",
    acceptanceCurrent: true,
    filename: "livret.docx",
    alreadySigned: false,
  };

  it("la direction signe un document accepté, Word ou PDF", () => {
    expect(signingRefusal(ok)).toBeNull();
    expect(signingRefusal({ ...ok, filename: "livret.PDF" })).toBeNull();
  });

  it.each([
    [{ accessRole: "RESPONSABLE_QUALITE" as const }, "NOT_DIRECTION"],
    [{ accessRole: null }, "NOT_DIRECTION"],
    [{ canWrite: false }, "CLOSED"],
    [{ documentTypeCode: "DEPARTEMENT_TAMPON" }, "RESTRICTED"],
    [{ acceptanceCurrent: false }, "NOT_ACCEPTED"],
    [{ filename: "tableau.xlsx" }, "UNSUPPORTED_FORMAT"],
    [{ alreadySigned: true }, "ALREADY_SIGNED"],
  ])("refuse %o → %s", (patch, refusal) => {
    expect(signingRefusal({ ...ok, ...patch })).toBe(refusal);
  });
});

describe("matchRenderedParagraph — l'endroit touché dans l'aperçu Word", () => {
  const xml = ["Titre", "Le présent document", "", "Fait à Paris", "", "", "Annexe", "Fait à Paris"];

  it("un paragraphe écrit : par son texte et son rang", () => {
    expect(matchRenderedParagraph(xml, xml, 1)).toBe(1);
    expect(matchRenderedParagraph(xml, xml, 7)).toBe(7);
    expect(matchRenderedParagraph(xml, xml, 3)).toBe(3);
  });

  it("une ligne vide : depuis la dernière ligne écrite au-dessus", () => {
    expect(matchRenderedParagraph(xml, xml, 5)).toBe(5);
    expect(matchRenderedParagraph(xml, xml, 2)).toBe(2);
  });

  it("l'aperçu dessine plus de lignes vides que le Word : on se pose après la ligne écrite", () => {
    const rendered = ["Titre", "Le présent document", "", "", "", "Fait à Paris"];
    expect(matchRenderedParagraph(xml, rendered, 4)).toBe(1);
  });

  it("un texte que le Word n'a pas (champ calculé, numéro de page) : rien", () => {
    expect(matchRenderedParagraph(xml, ["Page 1 sur 3"], 0)).toBeNull();
  });

  it("une ligne vide en tout début, un rang hors liste : rien", () => {
    expect(matchRenderedParagraph(["", "A"], ["", "A"], 0)).toBeNull();
    expect(matchRenderedParagraph(xml, xml, 99)).toBeNull();
  });

  it("normalizeLine resserre les espaces comme le Word", () => {
    expect(normalizeLine("  Fait   à\tParis \n")).toBe("Fait à Paris");
  });
});

describe("cardSignatureOffer — ce que la carte propose", () => {
  const facts = { accepted: true, isDirection: true, canAct: true, restricted: false, filename: "a.pdf", signedAt: null };
  it("la direction, sur un document accepté : signer", () => {
    expect(cardSignatureOffer(facts)).toBe("SIGN");
  });
  it("déjà signé : la copie signée, pour tous les rôles et même en bibliothèque", () => {
    expect(cardSignatureOffer({ ...facts, isDirection: false, canAct: false, signedAt: new Date() })).toBe("SIGNED");
  });
  it.each([
    [{ accepted: false }],
    [{ isDirection: false }],
    [{ canAct: false }],
    [{ restricted: true }],
    [{ filename: "a.xlsx" }],
    [{ filename: null }],
  ])("rien à proposer : %o", (patch) => {
    expect(cardSignatureOffer({ ...facts, ...patch })).toBeNull();
  });
});

describe("noms de fichiers", () => {
  it("signableKind", () => {
    expect(signableKind("a.docx")).toBe("DOCX");
    expect(signableKind("a.pdf")).toBe("PDF");
    expect(signableKind("a.doc")).toBeNull();
  });
  it("signedFilename", () => {
    expect(signedFilename("Livret accueil.docx")).toBe("Livret accueil-signe.docx");
    expect(signedFilename("livret-signe.pdf")).toBe("livret-signe.pdf");
  });
});
