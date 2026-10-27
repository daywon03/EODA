import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { admissionFieldValues, dipcEntryValues, EMPTY_AID, EMPTY_CONTACT, EMPTY_IDENTITY } from "./admission-service";
import {
  addImageRelationships,
  buildFilledDocx,
  ensurePngContentType,
  escapeXml,
  fillDipecWord,
  normalizeWithMap,
  NotAWordDocumentError,
  openDocx,
  planDipecWord,
  pngSize,
  readParagraphs,
  rewriteParagraph,
  rhythmText,
  unescapeXml,
  wordSignatureSlots,
} from "./dipec-word-service";
import { EMPTY_TRUSTED_PERSON } from "./trusted-person-service";
import { buildStoredZip } from "./zip-store";
import { readZip } from "./zip-read";

// Word FICTIF qui reprend la FORME du DIPEC d'EODA (mesurée sur le vrai, 27/10/2026) :
// zone en pointillés coupée sur trois runs, sommaire (style TM1), options de durée en
// liste à puce-case, tableau « Remise et signature », annexe 3.2. Aucun texte réel.
const run = (text: string, rPr = "<w:rPr><w:b/></w:rPr>") => `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
const p = (body: string, pPr = "") => `<w:p w14:paraId="X">${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${body}</w:p>`;
const style = (name: string) => `<w:pStyle w:val="${name}"/>`;
const cell = (...paras: string[]) => `<w:tc>${paras.join("")}</w:tc>`;

const DOC = [
  '<?xml version="1.0"?><w:document xmlns:w="w" xmlns:wp="wp" xmlns:r="r" xmlns:w14="w14"><w:body>',
  p(run("ANNEXE 1 – DEVIS"), style("TM1")),
  p(run("Document individuel de prise en charge"), style("Titre")),
  p(`${run("Nom, Prénom :  ………………", "<w:rPr><w:i/></w:rPr>")}<w:proofErr/>${run("…….")}${run(".")}`),
  p(run("…………………………")),
  p(run("Domicile : ………………")),
  p(run("Volet aide"), style("Titre1")),
  p(run("Option n°1 – Le présent contrat est conclu pour une durée indéterminée"), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="5"/></w:numPr>'),
  p(run("Option n°2 – Le présent contrat est conclu pour une durée déterminée du JJ/MM/AAAA au JJ/MM/AAAA"), '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="5"/></w:numPr>'),
  `<w:tbl><w:tr>${cell(p(run("Fréquence, jours et horaires des interventions")))}${cell(p(run("[à compléter]")))}</w:tr></w:tbl>`,
  p(run("3.4. Le rythme des interventions"), style("Titre2")),
  p(run("Les jours et horaires d’intervention sont définis par la structure avec le bénéficiaire.")),
  p(run("☐ Le livret d’accueil")),
  `<w:tbl><w:tr>${cell(p(run("Pour la structure")), p(run("Nom, fonction :")), p(run("Signature :")))}${cell(
    p(run("Le bénéficiaire ou son représentant légal")),
    p(run("Nom, prénom :")),
    p(run("Signature, précédée de la mention « Lu et approuvé » :"))
  )}</w:tr></w:tbl>`,
  p(run("ANNEXE 3 – PERSONNE DE CONFIANCE"), style("Titre1")),
  p(run("Annexe 3.2")),
  p(run("Je soussigné(e), Nom et Prénom, né(e) le JJ/MM/AA à … :")),
  p(run("Nom et prénom :")),
  p(run("E-mail :")),
  p(run("Fait à…, le…")),
  p(run("Signature :")),
  p(run("Cosignature de la personne de confiance :")),
  p(run("Partie facultative")),
  p(run("Signature :")),
  "</w:body></w:document>",
].join("");

// PNG valide de 4 × 2 (seul l'en-tête IHDR est lu).
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 4, 0, 0, 0, 2, 8, 6, 0, 0, 0]);

const plan = planDipecWord(DOC);
const aid = { ...EMPTY_AID, kinds: ["APA" as const], startDate: "2026-11-02", weekdayHours: "20", sundayHours: "2,5" };
const trusted = { ...EMPTY_TRUSTED_PERSON, presence: "PRESENTE" as const, lastName: "Exemple", firstName: "Jeanne", email: "jeanne@exemple.fr" };
const values = admissionFieldValues({
  structureName: "SAD Fictif",
  identity: { ...EMPTY_IDENTITY, civility: "MADAME", birthName: "Durand", firstName: "Paulette", address: "1 rue Fictive", postalCode: "93000", city: "Ville-Fictive" },
  aid,
  contact: { ...EMPTY_CONTACT },
  trusted,
  staffName: "Camille",
  signedOn: new Date("2026-10-27T10:00:00Z"),
});
const entries = dipcEntryValues(plan.prepared, { [plan.scheduleFieldId ?? ""]: "lundi, 9 h – 11 h" }, { "coche.1": true }, { choice: 1, start: "", end: "" });
const signatures = {
  STRUCTURE: [{ caption: "Pour le service — Camille", png: PNG }],
  BENEFICIAIRE: [{ caption: "La personne accompagnée — DURAND Paulette — Lu et approuvé", png: PNG }],
  ANNEXE_PERSONNE: [{ caption: "DURAND Paulette", png: PNG }],
  CONFIANCE: [{ caption: "EXEMPLE Jeanne", png: PNG }],
};
const fill = (trustedDesignated: boolean) =>
  fillDipecWord({ documentXml: DOC, plan, values, entries, trustedDesignated, rhythm: rhythmText(aid, "lundi, 9 h – 11 h"), signatures });
const textOf = (xml: string) => readParagraphs(xml).map((q) => q.raw);

describe("lecture du Word", () => {
  it("échappe et déséchappe le XML", () => {
    expect(unescapeXml("a &lt;b&gt; &amp; &quot;c&quot; &apos;d&apos; &#233;&#xE9;")).toBe(`a <b> & "c" 'd' éé`);
    expect(escapeXml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });

  it("lit les paragraphes feuilles, dans l'ordre, avec leur style", () => {
    const paragraphs = readParagraphs(`<w:p><w:r><w:t>a</w:t></w:r></w:p><w:p/><w:p><w:r><w:drawing><w:p><w:r><w:t>boîte</w:t></w:r></w:p></w:drawing></w:r></w:p>${p(run("b"), style("Titre1"))}`);
    expect(paragraphs.map((q) => [q.raw, q.style])).toEqual([
      ["a", ""],
      ["boîte", ""],
      ["b", "Titre1"],
    ]);
  });

  it("resserre les espaces en gardant la position de chaque caractère", () => {
    expect(normalizeWithMap(" a \t b ")).toEqual({ text: "a b", map: [1, 2, 5, 6] });
    expect(normalizeWithMap("   ")).toEqual({ text: "", map: [0] });
  });
});

describe("planDipecWord — mêmes zones que la copie en texte", () => {
  it("repère zones, saisies, cases, durée ; ignore le sommaire", () => {
    expect(plan.prepared.identityZones).toBe(6);
    expect(plan.prepared.freeFields).toEqual([{ id: "saisie.1", label: "Fréquence, jours et horaires des interventions", hint: "" }]);
    expect(plan.prepared.checkFields).toEqual([{ id: "coche.1", label: "Le livret d’accueil" }]);
    expect(plan.prepared.durationChoice?.options.map((o) => o.number)).toEqual([1, 2]);
    expect(plan.scheduleFieldId).toBe("saisie.1");
    expect(plan.rhythmAfter).not.toBeNull();
    expect([...plan.templates.values()]).not.toContain("ANNEXE 1 – DEVIS");
  });

  it("place les signatures par cellule, et l'annexe 3.2 jusqu'à la partie facultative seulement", () => {
    expect(plan.anchors.map((a) => a.slot)).toEqual(["STRUCTURE", "BENEFICIAIRE", "ANNEXE_PERSONNE", "CONFIANCE"]);
    expect([...plan.trustedTemplates.values()]).toEqual([
      "Je soussigné(e), {{personne.prenom}} {{personne.nom}}, né(e) le {{personne.date_naissance}} à {{personne.lieu_naissance}} :",
      "Nom et prénom : {{confiance.nom}}",
      "E-mail : {{confiance.email}}",
      "Fait à {{personne.ville}}, le {{date.signature}}",
    ]);
  });

  it("un Word sans annexe 3.2 ni article 3.4 : rien à y poser", () => {
    const bare = planDipecWord(p(run("Nom, fonction :")));
    expect([bare.trustedTemplates.size, bare.rhythmAfter, bare.scheduleFieldId]).toEqual([0, null, null]);
  });
});

describe("rewriteParagraph — seul le passage qui change est réécrit", () => {
  it("écrit après le libellé, dans son run, et vide les runs de pointillés", () => {
    const [para] = readParagraphs(p(`${run("Nom, Prénom :  ………", "<w:rPr><w:i/></w:rPr>")}${run("……")}${run(".")}`));
    const xml = rewriteParagraph(para!, "Nom, Prénom : Madame Paulette DURAND");
    expect(readParagraphs(xml)[0]!.raw).toBe("Nom, Prénom : Madame Paulette DURAND");
    expect(xml).toContain('<w:rPr><w:i/></w:rPr><w:t xml:space="preserve">Nom, Prénom : Madame Paulette DURAND</w:t>');
    expect(xml.match(/<w:t xml:space="preserve"><\/w:t>/g)).toHaveLength(2);
  });

  it("ne touche à rien quand le texte ne change pas ; un paragraphe sans texte reste tel quel", () => {
    const [para] = readParagraphs(p(run("Texte")));
    expect(rewriteParagraph(para!, "Texte")).toBe(para!.xml);
    const [empty] = readParagraphs("<w:p><w:pPr/></w:p>");
    expect(rewriteParagraph(empty!, "x")).toBe(empty!.xml);
  });

  it("ajoute en fin de paragraphe dans le dernier run, et garde le préfixe commun", () => {
    const [para] = readParagraphs(p(`${run("Adresse ")}${run(":")}`));
    expect(readParagraphs(rewriteParagraph(para!, "Adresse : 1 rue < Fictive"))[0]!.raw).toBe("Adresse : 1 rue < Fictive");
  });
});

describe("fillDipecWord", () => {
  const withTrusted = fill(true);
  const lines = textOf(withTrusted.documentXml);

  it("remplit l'identité, efface la ligne de pointillés, coche, choisit la durée sans doubler la case", () => {
    expect(lines).toContain("Nom, Prénom : Madame Paulette DURAND");
    expect(lines).toContain("Domicile : 1 rue Fictive, 93000 Ville-Fictive");
    expect(lines).toContain("");
    expect(lines).toContain("☒ Le livret d’accueil");
    expect(lines.find((l) => l.includes("Option n°1"))).toMatch(/^☒ Option n°1/);
    expect(withTrusted.documentXml.match(/<w:numPr>/g)).toBeNull();
    expect(withTrusted.unknownFields).toEqual([]);
    expect(withTrusted.emptyFields).toEqual(expect.arrayContaining(["duree.debut", "duree.fin"]));
  });

  it("article 3.4 : le rythme convenu s'écrit sous la phrase qui l'annonce", () => {
    const i = lines.findIndex((l) => l.startsWith("Les jours et horaires"));
    expect(lines[i + 1]).toBe(
      "Rythme convenu avec le bénéficiaire : Allocation personnalisée d'autonomie (APA) — 20 h par mois en semaine, 2,5 h par mois le dimanche — à partir du 02/11/2026. Jours et horaires : lundi, 9 h – 11 h."
    );
  });

  it("pose quatre signatures (structure, bénéficiaire, annexe 3.2, cosignature), légende au-dessus", () => {
    expect(withTrusted.images.map((img) => img.target)).toEqual([1, 2, 3, 4].map((n) => `media/eoda-signature-${n}.png`));
    expect(lines.indexOf("Pour le service — Camille")).toBe(lines.indexOf("Signature :") + 1);
    expect(lines).toContain("Nom et prénom : Jeanne EXEMPLE");
    expect(lines).toContain("E-mail : jeanne@exemple.fr");
    expect(withTrusted.documentXml.match(/<wp:inline /g)).toHaveLength(4);
    expect(withTrusted.documentXml).toContain('<a:ext cx="1152000" cy="576000"/>');
  });

  it("sans personne de confiance : l'annexe 3.2 reste vierge, deux signatures seulement", () => {
    const without = fill(false);
    expect(without.images).toHaveLength(2);
    expect(textOf(without.documentXml)).toContain("Nom et prénom :");
    expect(textOf(without.documentXml)).not.toContain("EXEMPLE Jeanne");
  });

  it("sans rythme : rien n'est ajouté sous l'article 3.4", () => {
    expect(rhythmText(EMPTY_AID, " ")).toBe("");
    expect(rhythmText({ ...EMPTY_AID, weekdayHours: "10" }, "")).toBe("Rythme convenu avec le bénéficiaire : 10 h par mois en semaine.");
    const none = fillDipecWord({ documentXml: DOC, plan, values, entries, trustedDesignated: false, rhythm: "", signatures: {} });
    expect(textOf(none.documentXml).some((l) => l.startsWith("Rythme convenu"))).toBe(false);
  });
});

describe("wordSignatureSlots — qui signe où", () => {
  const images = { PERSONNE: PNG, REPRESENTANT: PNG, SERVICE: PNG, CONFIANCE: PNG };
  const identity = { ...EMPTY_IDENTITY, birthName: "Durand", firstName: "Paulette" };

  it("structure dans sa cellule ; la personne et son curateur dans la leur, « Lu et approuvé » ; la cosignature", () => {
    const slots = wordSignatureSlots({ images, identity, contact: { ...EMPTY_CONTACT, kind: "CURATEUR", lastName: "Leroy", firstName: "Marc" }, staffName: "Camille", trusted });
    expect(slots.STRUCTURE?.map((s) => s.caption)).toEqual(["Pour le service — Camille"]);
    expect(slots.BENEFICIAIRE?.map((s) => s.caption)).toEqual([
      "La personne accompagnée — DURAND Paulette — Lu et approuvé",
      "Curateur — LEROY Marc — Lu et approuvé",
    ]);
    expect(slots.ANNEXE_PERSONNE?.map((s) => s.caption)).toEqual(["DURAND Paulette"]);
    expect(slots.CONFIANCE?.map((s) => s.caption)).toEqual(["EXEMPLE Jeanne"]);
  });

  it("sous tutelle, le tuteur signe l'annexe 3.2 ; une signature absente ne laisse pas d'image vide", () => {
    const slots = wordSignatureSlots({ images: { REPRESENTANT: PNG, SERVICE: PNG }, identity, contact: { ...EMPTY_CONTACT, kind: "TUTEUR", lastName: "Leroy" }, staffName: "Camille", trusted: null });
    expect(slots.ANNEXE_PERSONNE?.map((s) => s.caption)).toEqual(["LEROY"]);
    expect(slots.BENEFICIAIRE?.map((s) => s.caption)).toEqual(["Tuteur — LEROY — Lu et approuvé"]);
    expect(slots.CONFIANCE).toEqual([]);
  });
});

describe("archive .docx", () => {
  const at = new Date("2026-10-27T10:00:00Z");
  const enc = (s: string) => new TextEncoder().encode(s);
  const source = buildStoredZip([
    { name: "[Content_Types].xml", data: enc('<Types xmlns="t"><Default Extension="xml" ContentType="application/xml"/></Types>'), modifiedAt: at },
    { name: "word/document.xml", data: enc(DOC), modifiedAt: at },
    { name: "word/_rels/document.xml.rels", data: enc('<Relationships xmlns="r"></Relationships>'), modifiedAt: at },
  ]);
  const inflate = async (d: Uint8Array) => new Uint8Array(inflateRawSync(d));

  it("ouvre, remplit et referme : images, relations et type PNG ajoutés", async () => {
    const pkg = await openDocx(source, inflate);
    const out = await readZip(buildFilledDocx(pkg, fill(true), at), inflate);
    const byName = Object.fromEntries(out.map((e) => [e.name, new TextDecoder().decode(e.data)]));
    expect(Object.keys(byName)).toEqual(expect.arrayContaining(["word/media/eoda-signature-1.png", "word/media/eoda-signature-4.png"]));
    expect(byName["word/_rels/document.xml.rels"]).toContain('Id="rIdEodaSignature4"');
    expect(byName["[Content_Types].xml"]).toContain('Extension="png"');
    expect(byName["word/document.xml"]).toContain("Madame Paulette DURAND");
  });

  it("refuse une archive qui n'est pas un Word", async () => {
    const zip = buildStoredZip([{ name: "a.txt", data: enc("x"), modifiedAt: at }]);
    await expect(openDocx(zip, inflate)).rejects.toBeInstanceOf(NotAWordDocumentError);
  });

  it("relations et types : idempotent pour le PNG, taille lue dans l'en-tête", () => {
    const ct = '<Types xmlns="t"><Default Extension="PNG" ContentType="image/png"/></Types>';
    expect(ensurePngContentType(ct)).toBe(ct);
    expect(addImageRelationships("<Relationships></Relationships>", [])).toBe("<Relationships></Relationships>");
    expect(pngSize(PNG)).toEqual({ width: 4, height: 2 });
    expect(pngSize(enc("pas un png, pas du tout"))).toBeNull();
  });
});
