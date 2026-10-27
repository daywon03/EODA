import { describe, expect, it } from "vitest";
import { blankZonesIn, cleanMarkdownText, prepareDipcForTablet } from "./dipc-tablet-preparation";
import { admissionFieldValues, dipcEntryValues, EMPTY_AID, EMPTY_CONTACT, EMPTY_FIELD_MARK, EMPTY_IDENTITY, mergeDipcBlocks } from "./admission-service";

// DIPC FICTIF qui reprend la FORME du texte extrait d'un DIPC d'EODA (Markdown du
// Word : gras, échappements, sommaire, pointillés, crochets en italique,
// « [à compléter] », cases ☐, annexes). Aucun texte réel de structure ici.
const DIPC = [
  "**[Image 1]**",
  "[Volet aide 2](#_Toc111)",
  "**Document individuel de prise en charge**",
  "L’Association FICTIVE, représentée par sa directrice",
  "Nom, Prénom : ……………………………………………………..",
  "………………………………………………………………..",
  "Domicile : …………………………………………………………………",
  "Téléphone : ……………………………………………",
  "– Personne accompagnée : _\\[Nom et prénom\\]_ ;",
  "– Représentant légal, le cas échéant : _\\[Nom, prénom et qualité_\\] ;",
  "– Autre personne associée à la demande de la personne accompagnée : _\\[Nom, prénom et qualité / sans objet\\]._",
  "# Volet aide",
  "*   Option n°1 – Le présent contrat est conclu pour une durée indéterminée**[\\[1\\]](#footnote-1)**",
  "Objectifs de l’accompagnement",
  "\\[à compléter\\]",
  "Modalités de coordination",
  "\\[à compléter\\] (voir aussi annexe 4 du présent DIPC)",
  "Délai de formalisation de l'avenant",
  "\\[à compléter — dans un délai de 6 mois suivant la signature\\]",
  "Réévaluation annuelle ; prochaine révision prévue le : ../../....",
  "Date d’admission : \\_\\_\\_\\_ / \\_\\_\\_\\_ / \\_\\_\\_\\_\\_\\_\\_\\_",
  "Date de remise du présent document : \\_\\_\\_\\_ / \\_\\_\\_\\_ / \\_\\_\\_\\_\\_\\_\\_\\_",
  "☐ Le livret d’accueil",
  "Présentation orale réalisée par (nom, fonction) :",
  "Le bénéficiaire était accompagné de (nom, qualité) :",
  "☐ Non accompagné(e)",
  "Fait à \\_\\_\\_\\_\\_\\_\\_\\_, le \\_\\_\\_\\_ / \\_\\_\\_\\_ / \\_\\_\\_\\_\\_\\_\\_\\_, en deux exemplaires originaux.",
  "Nom, fonction :",
  "Nom, prénom :",
  "Signature, précédée de la mention « Lu et approuvé » :",
  "# ANNEXE 2 - FORMULAIRE DE RETRACTATION",
  "Nom du (des) consommateur(s) :",
  "Fait à…, le…",
  "□ Je lui ai fait part de mes directives anticipées",
  "Nom, prénom :",
  "\\[à compléter\\]",
].join("\n\n");

const prepared = prepareDipcForTablet(DIPC);
const texts = prepared.blocks.map((b) => b.text);
const annexStart = prepared.blocks.findIndex((b) => b.kind === "heading" && b.text.startsWith("ANNEXE"));

describe("cleanMarkdownText", () => {
  it("retire gras, échappements, liens, renvois de note", () => {
    expect(cleanMarkdownText("**Article 1** – voir \\[ici\\] [la loi](https://x.fr) et [\\[2\\]](#footnote-2)")).toBe("Article 1 – voir [ici] la loi et [2]");
    expect(cleanMarkdownText("un _mot en italique_ ici")).toBe("un mot en italique ici");
    expect(cleanMarkdownText("1. Une note de bas de page. [↑](#footnote-ref-1)")).toBe("1. Une note de bas de page.");
    expect(cleanMarkdownText("des 6° et 7°_ _du I​")).toBe("des 6° et 7° du I");
  });
});

describe("prepareDipcForTablet", () => {
  it("ne laisse ni repère d'image, ni ligne de sommaire, ni Markdown", () => {
    expect(texts.join("\n")).not.toMatch(/\*\*|\\\[|\]\(#|\[Image/);
    expect(prepared.blocks[0]).toEqual({ kind: "paragraph", text: "Document individuel de prise en charge" });
    expect(prepared.blocks).toContainEqual({ kind: "heading", text: "Volet aide" });
    expect(prepared.blocks).toContainEqual({ kind: "bullet", text: "Option n°1 – Le présent contrat est conclu pour une durée indéterminée[1]" });
  });

  it("pose les champs d'identité sur les zones repérées par leur libellé, et efface la ligne de pointillés qui suit", () => {
    expect(texts).toContain("Nom, Prénom : {{personne.civilite}} {{personne.prenom}} {{personne.nom}}");
    expect(texts).toContain("Domicile : {{personne.adresse}}, {{personne.code_postal}} {{personne.ville}}");
    expect(texts).toContain("Téléphone : {{personne.telephone}}");
    expect(texts).toContain("– Personne accompagnée : {{personne.prenom}} {{personne.nom}} ;");
    expect(texts).toContain("– Représentant légal, le cas échéant : {{representant.identite}} ;");
    expect(texts).toContain("– Autre personne associée à la demande de la personne accompagnée : {{proche.identite}}.");
    expect(texts).toContain("Réévaluation annuelle ; prochaine révision prévue le : {{date.revision}}");
    expect(texts).toContain("Date d’admission : {{aide.date_debut}}");
    expect(texts).toContain("Date de remise du présent document : {{date.signature}}");
    expect(texts).toContain("Fait à {{personne.ville}}, le {{date.signature}}, en deux exemplaires originaux.");
    expect(texts).toContain("Présentation orale réalisée par (nom, fonction) : {{intervenant.nom}}");
    expect(texts.slice(0, annexStart)).toContain("Nom, prénom : {{signataire.nom}}");
    expect(texts.filter((t) => /^…+\.*$/.test(t))).toEqual([]);
    // 13 zones listées ci-dessus + « Signature, précédée de la mention… ».
    expect(prepared.identityZones).toBe(14);
  });

  it("« [à compléter] » devient une zone de saisie, avec le libellé du dessus et l'aide du texte", () => {
    expect(prepared.freeFields).toEqual([
      { id: "saisie.1", label: "Objectifs de l’accompagnement", hint: "" },
      { id: "saisie.2", label: "Modalités de coordination", hint: "(voir aussi annexe 4 du présent DIPC)" },
      { id: "saisie.3", label: "Délai de formalisation de l'avenant", hint: "dans un délai de 6 mois suivant la signature" },
      { id: "saisie.4", label: "Le bénéficiaire était accompagné de (nom, qualité)", hint: "" },
    ]);
    expect(texts).toContain("{{saisie.2}} (voir aussi annexe 4 du présent DIPC)");
  });

  it("chaque ☐ du contrat devient une case", () => {
    expect(prepared.checkFields).toEqual([
      { id: "coche.1", label: "Le livret d’accueil" },
      { id: "coche.2", label: "Non accompagné(e)" },
    ]);
  });

  it("ne touche jamais aux annexes : la personne les remplit elle-même", () => {
    const annexes = texts.slice(annexStart);
    expect(annexes).toEqual([
      "ANNEXE 2 - FORMULAIRE DE RETRACTATION",
      "Nom du (des) consommateur(s) :",
      "Fait à…, le…",
      "□ Je lui ai fait part de mes directives anticipées",
      "Nom, prénom :",
      "[à compléter]",
    ]);
    expect(annexes.join(" ")).not.toContain("{{");
  });

  it("le corps du contrat n'a plus de zone vide", () => {
    expect(texts.slice(0, annexStart).reduce((n, t) => n + blankZonesIn(t), 0)).toBe(0);
    expect(blankZonesIn("Nom : …………… et ____")).toBe(2);
  });
});

describe("remplissage de la copie", () => {
  const values = admissionFieldValues({
    structureName: "SAD Fictif",
    identity: { ...EMPTY_IDENTITY, civility: "MADAME", birthName: "Durand", firstName: "Paulette", city: "Ville-Fictive" },
    aid: EMPTY_AID,
    contact: { ...EMPTY_CONTACT, kind: "CURATEUR", lastName: "Leroy", firstName: "Marc" },
    staffName: "Camille",
    signedOn: new Date("2026-10-27T10:00:00Z"),
  });
  const entries = dipcEntryValues(prepared, { "saisie.1": "  Rester  chez elle  " }, { "coche.1": true });
  const filled = mergeDipcBlocks(prepared.blocks, values, entries);
  const all = filled.blocks.map((b) => b.text);

  it("remplit identité, représentant, signataire, révision ; saisies et cases", () => {
    expect(filled.unknownFields).toEqual([]);
    expect(all).toContain("Nom, Prénom : Madame Paulette DURAND");
    expect(all).toContain("– Représentant légal, le cas échéant : Marc LEROY, curateur ;");
    expect(all).toContain("– Autre personne associée à la demande de la personne accompagnée : sans objet.");
    expect(all).toContain("Nom, prénom : DURAND Paulette, assisté(e) de Marc LEROY, curateur");
    expect(all).toContain("Réévaluation annuelle ; prochaine révision prévue le : 27/10/2027");
    expect(all).toContain("Rester chez elle");
    expect(all).toContain("☒ Le livret d’accueil");
    expect(all).toContain("☐ Non accompagné(e)");
  });

  it("une saisie laissée vide reste une ligne à compléter à la main", () => {
    expect(all).toContain(`${EMPTY_FIELD_MARK} (voir aussi annexe 4 du présent DIPC)`);
    expect(filled.emptyFields).toContain("saisie.2");
  });
});
