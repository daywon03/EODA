import { describe, expect, it } from "vitest";
import { admissionFieldValues, EMPTY_AID, EMPTY_CONTACT, EMPTY_IDENTITY } from "./admission-service";
import { escapeXml, normalizeWithMap, readParagraphs } from "./dipec-word-service";
import { fillRecapContract, planRecapContract, recapCompanion, recapContractGaps, tariffCellTexts } from "./recap-contract-word-service";

// Word FICTIF qui reprend la FORME du contrat récapitulatif de la structure pilote
// (mesurée sur le vrai, 30/10/2026) : pointillés sous « Et », « Demeurant » coupé sur
// deux runs, cases Wingdings devant les durées, tableau des tarifs vide, « M… » en
// plusieurs runs, signatures séparées par une tabulation, lignes vides pour signer.
const R = "<w:rPr><w:rFonts w:ascii=\"Verdana\"/><w:sz w:val=\"18\"/></w:rPr>";
const run = (text: string) => `<w:r>${R}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
const box = `<w:r>${R}<w:sym w:font="Wingdings" w:char="F072"/></w:r>`;
const pPr = `<w:pPr><w:tabs><w:tab w:val="left" w:pos="4500"/></w:tabs>${R}</w:pPr>`;
const p = (body: string) => `<w:p>${pPr}${body}</w:p>`;
const empty = `<w:p>${pPr}</w:p>`;
const cell = (...paras: string[]) => `<w:tc><w:tcPr/>${paras.join("")}</w:tc>`;
const DOTS = "……………………………………";
const DOC = [
  '<?xml version="1.0"?><w:document xmlns:w="w" xmlns:wp="wp" xmlns:r="r"><w:body>',
  p(run("CONTRAT D’INTERVENTION A DOMICILE")),
  p(run("Entre les parties, la structure fictive, représentée par sa direction,")),
  p(run("Et")),
  empty,
  p(run(DOTS)),
  p(`${run("Demeurant ")}${run(DOTS)}`),
  p(run(DOTS)),
  p(run(DOTS)),
  p(run("Dénommé le bénéficiaire,")),
  p(`${box}${run(" Pour une durée d’une année de date à date renouvelable par tacite reconduction")}`),
  p(`${box}${run(" Pour une durée déterminée du ")}${run(DOTS)}${run(". ")}${run("au")}${run(" ")}${run(DOTS)}`),
  `<w:tbl><w:tr>${["Tarif Horaire Semaine", "Nombre d’heures mensuelles", "Tarif Horaire Dim/JF", "Nombre d’heures mensuelles", "Total Mensuel à payer"].map((t) => cell(p(run(t)))).join("")}</w:tr>` +
    `<w:tr>${[1, 2, 3, 4, 5].map(() => cell(empty, empty)).join("")}</w:tr></w:tbl>`,
  p(`${run("M")}${run(DOTS)}${run("…….")}${run(", ou son représentant légal, peut être accompagné de la personne de son choix M")}${run(DOTS)}${run(", et déclare avoir pris connaissance du présent contrat.")}`),
  p(`${run("Fait à ")}${run(DOTS)}${run(", le ")}${run(DOTS)}`),
  p(`${run("Signature du Bénéficiaire")}<w:r>${R}<w:tab/></w:r>${run("Signature du représentant de la structure")}`),
  p(run("Ou du représentant légal")),
  p(run("Ou de la personne de son choix")),
  ...Array.from({ length: 9 }, () => empty),
  '<w:sectPr/></w:body></w:document>',
].join("");

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 4, 0, 0, 0, 2, 8, 6, 0, 0, 0]);
const values = admissionFieldValues({
  structureName: "SAD Fictif",
  identity: { ...EMPTY_IDENTITY, civility: "MADAME", birthName: "Durand", firstName: "Paulette", address: "1 rue Fictive", postalCode: "93000", city: "Ville-Fictive" },
  aid: { ...EMPTY_AID, kinds: ["APA"], startDate: "2026-11-02", weekdayHours: "20", sundayHours: "2,5" },
  contact: { ...EMPTY_CONTACT },
  trusted: null,
  staffName: "Camille",
  signedOn: new Date("2026-10-30T10:00:00Z"),
});
const plan = planRecapContract(DOC);
const texts = (xml: string) => readParagraphs(xml).map((q) => normalizeWithMap(q.raw).text);
const fill = (over: Partial<Parameters<typeof fillRecapContract>[0]> = {}) =>
  fillRecapContract({
    documentXml: DOC,
    plan,
    values,
    companion: "Jeanne EXEMPLE",
    duration: { fixed: false, start: "", end: "" },
    tariffs: { weekdayRate: "24,50", sundayRate: "27" },
    signatures: { beneficiary: [{ caption: "La personne accompagnée — Paulette DURAND — Lu et approuvé", png: PNG }], structure: [{ caption: "Pour le service — Camille", png: PNG }] },
    ...over,
  });

describe("planRecapContract", () => {
  it("repère chaque zone par son libellé", () => {
    const paragraphs = readParagraphs(DOC);
    const at = (i: number | null) => (i === null ? null : normalizeWithMap(paragraphs[i]!.raw).text);
    expect(at(plan.beneficiary)).toBe(DOTS);
    expect(at(plan.address)).toMatch(/^Demeurant/);
    expect(plan.addressContinuation).toHaveLength(2);
    expect(at(plan.durationIndefinite)).toMatch(/d’une année/);
    expect(at(plan.durationFixed)).toMatch(/déterminée/);
    expect(plan.tariffCells).toHaveLength(5);
    expect(at(plan.declaration)).toMatch(/^M…/);
    expect(at(plan.madeAt)).toMatch(/^Fait à/);
    expect(plan.signatureBlanks).toHaveLength(9);
    expect(recapContractGaps(plan)).toEqual([]);
  });

  it("un Word sans ces zones le dit, sans rien inventer", () => {
    const bare = planRecapContract('<w:document><w:body><w:p><w:r><w:t>Autre chose</w:t></w:r></w:p></w:body></w:document>');
    expect(recapContractGaps(bare)).toEqual(["le nom du bénéficiaire", "l'adresse", "la place des signatures"]);
    expect(fillRecapContract({ documentXml: '<w:document><w:body><w:p><w:r><w:t>Autre chose</w:t></w:r></w:p></w:body></w:document>', plan: bare, values, companion: "", duration: null, tariffs: { weekdayRate: "", sundayRate: "" }, signatures: { beneficiary: [], structure: [] } }).images).toEqual([]);
  });
});

describe("fillRecapContract", () => {
  const filled = fill();
  const lines = texts(filled.documentXml);

  it("écrit la personne, son adresse, la déclaration et « Fait à … le … » — rien d'autre", () => {
    expect(lines).toContain("Madame Paulette DURAND");
    expect(lines).toContain("Demeurant 1 rue Fictive, 93000 Ville-Fictive");
    expect(lines).toContain(
      "Madame Paulette DURAND, ou son représentant légal, peut être accompagné de la personne de son choix Jeanne EXEMPLE, et déclare avoir pris connaissance du présent contrat."
    );
    expect(lines).toContain("Fait à Ville-Fictive, le 30/10/2026");
    // Les lignes de pointillés qui continuaient l'adresse sont vidées, pas supprimées.
    expect(lines.filter((l) => /^…+$/.test(l))).toEqual([]);
    expect(lines).toContain("CONTRAT D’INTERVENTION A DOMICILE");
    // La mise en forme des runs est gardée.
    expect(filled.documentXml).toContain('<w:rFonts w:ascii="Verdana"/>');
  });

  it("sans personne de son choix, la ligne reste à compléter à la main", () => {
    const line = texts(fill({ companion: "" }).documentXml).find((l) => l.includes("personne de son choix"))!;
    expect(line).toMatch(/choix M…+, et déclare/);
  });

  it("coche la durée choisie ; la durée déterminée reçoit ses dates", () => {
    expect(filled.documentXml.match(/w:char="F078"/g)).toHaveLength(1);
    expect(lines.find((l) => l.includes("déterminée"))).toMatch(/du …+\. au …+$/);
    const fixed = fill({ duration: { fixed: true, start: "02/11/2026", end: "01/11/2027" } });
    expect(texts(fixed.documentXml)).toContain("Pour une durée déterminée du 02/11/2026 au 01/11/2027");
    const paragraphs = readParagraphs(fixed.documentXml);
    const fixedXml = paragraphs.find((q) => normalizeWithMap(q.raw).text.includes("déterminée"))!.xml;
    expect(fixedXml).toContain('w:char="F078"');
    expect(texts(fill({ duration: null }).documentXml).join(" ")).not.toContain("F078");
    expect(fill({ duration: null }).documentXml).not.toContain('w:char="F078"');
  });

  it("remplit le tableau des tarifs, total mensuel calculé", () => {
    expect(lines).toEqual(expect.arrayContaining(["24,50 €", "20 h", "27,00 €", "2,5 h", "557,50 €"]));
  });

  it("pose les signatures dans un tableau à deux colonnes, sous « Signature du Bénéficiaire », à la place des lignes vides", () => {
    expect(filled.images.map((i) => i.relId)).toEqual(["rIdEodaRecap1", "rIdEodaRecap2"]);
    const after = filled.documentXml.slice(filled.documentXml.indexOf("Ou de la personne de son choix"));
    expect(after).toMatch(/<w:tbl>.*Lu et approuvé.*r:embed="rIdEodaRecap1".*Pour le service — Camille.*r:embed="rIdEodaRecap2"/s);
    // Quatre lignes vides rendues en échange du tableau : le contrat garde ses pages.
    expect(readParagraphs(after).filter((q) => !normalizeWithMap(q.raw).text && !q.xml.includes("w:drawing")).length).toBe(9 - 4);
  });
});

describe("tarifs", () => {
  it("le total n'est écrit que si chaque tarif utile est connu", () => {
    expect(tariffCellTexts({ weekdayRate: "24,5", sundayRate: "" }, "20", "")).toEqual(["24,50 €", "20 h", "", "", "490,00 €"]);
    expect(tariffCellTexts({ weekdayRate: "24,5", sundayRate: "" }, "20", "2")).toEqual(["24,50 €", "20 h", "", "2 h", ""]);
    expect(tariffCellTexts({ weekdayRate: "", sundayRate: "" }, "", "")).toEqual(["", "", "", "", ""]);
    expect(tariffCellTexts({ weekdayRate: "abc", sundayRate: "-3" }, "10", "")).toEqual(["", "10 h", "", "", ""]);
  });

  it("la personne de son choix : la personne de confiance d'abord, sinon le proche", () => {
    expect(recapCompanion("Jeanne EXEMPLE", "Luc AUTRE")).toBe("Jeanne EXEMPLE");
    expect(recapCompanion("", "Luc AUTRE")).toBe("Luc AUTRE");
    expect(recapCompanion("", "")).toBe("");
  });
});
