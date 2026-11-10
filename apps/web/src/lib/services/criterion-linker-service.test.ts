import { describe, expect, it } from "vitest";
import {
  analysisCriterionAction,
  filterLinkableCriteria,
  linkedCriteriaMessage,
  MAX_LINKER_RESULTS,
  unlinkCriterionQuestion,
  unlinkedCriterionMessage,
} from "./criterion-linker-service";

// « Je veux une liste des critères, je coche ce qui est bon » (Sandrine, 09/11/2026) :
// on cherche par NUMÉRO ou par MOT, jamais en recopiant un code.
const CRITERIA = [
  { code: "1.2.5", label: "Le professionnel informe la personne de la procédure de plainte et réclamation" },
  { code: "3.13.2", label: "Les événements indésirables sont déclarés et analysés" },
  { code: "3.14.2", label: "La structure dispose d'un plan de gestion de crise" },
  { code: "1.10.2", label: "Le projet personnalisé est co-construit" },
];

describe("filterLinkableCriteria", () => {
  it("sans recherche : tous les critères non rattachés, dans l'ordre reçu", () => {
    expect(filterLinkableCriteria(CRITERIA, "", new Set(["3.14.2"])).map((c) => c.code)).toEqual(["1.2.5", "3.13.2", "1.10.2"]);
  });

  it("par numéro, en tolérant tirets et espaces (« 3-14 » = « 3.14 »)", () => {
    expect(filterLinkableCriteria(CRITERIA, "3-14", new Set()).map((c) => c.code)).toEqual(["3.14.2"]);
    expect(filterLinkableCriteria(CRITERIA, "1.1", new Set()).map((c) => c.code)).toEqual(["1.10.2"]);
  });

  it("par mot du libellé, accents et casse ignorés", () => {
    expect(filterLinkableCriteria(CRITERIA, "evenements", new Set()).map((c) => c.code)).toEqual(["3.13.2"]);
    expect(filterLinkableCriteria(CRITERIA, "CRISE", new Set()).map((c) => c.code)).toEqual(["3.14.2"]);
  });

  it("n'affiche jamais un critère déjà rattaché", () => {
    expect(filterLinkableCriteria(CRITERIA, "crise", new Set(["3.14.2"]))).toEqual([]);
  });

  it("borne la liste affichée", () => {
    const many = Array.from({ length: MAX_LINKER_RESULTS + 30 }, (_, i) => ({ code: `1.1.${i + 1}`, label: "x" }));
    expect(filterLinkableCriteria(many, "", new Set())).toHaveLength(MAX_LINKER_RESULTS);
  });
});

// Détacher / rattacher DEPUIS L'ONGLET ANALYSE (retours de Sandrine, 09/11/2026) : la
// même matrice, les mêmes phrases que CriterionLinker — une seule source.
describe("analysisCriterionAction", () => {
  const linked = new Set(["3.14.2"]);

  it("critère attendu absent, encore rattaché : on peut le retirer", () => {
    expect(analysisCriterionAction({ code: "3.14.2", list: "missing", linkedCodes: linked })).toBe("UNLINK");
  });

  it("critère attendu absent, déjà retiré depuis l'analyse : plus de bouton", () => {
    expect(analysisCriterionAction({ code: "1.2.5", list: "missing", linkedCodes: linked })).toBeNull();
  });

  it("critère détecté non rattaché : on peut le rattacher", () => {
    expect(analysisCriterionAction({ code: "1.2.5", list: "detected", linkedCodes: linked })).toBe("LINK");
  });

  it("critère détecté déjà rattaché : rien à faire", () => {
    expect(analysisCriterionAction({ code: "3.14.2", list: "detected", linkedCodes: linked })).toBeNull();
  });

  it("matrice pas encore lue : aucun bouton (on ne propose pas à l'aveugle)", () => {
    expect(analysisCriterionAction({ code: "1.2.5", list: "detected", linkedCodes: null })).toBeNull();
  });
});

describe("phrases partagées du rattachement", () => {
  it("la question de retrait dit ce que vaut le geste (refus d'une proposition, ou retrait)", () => {
    expect(unlinkCriterionQuestion("3.14.2", true)).toMatch(/refuser la proposition de la matrice/);
    expect(unlinkCriterionQuestion("3.14.2", false)).toMatch(/dans toutes les structures/);
  });

  it("le message de rattachement invite à relancer l'analyse", () => {
    expect(linkedCriteriaMessage(1)).toBe(
      "1 critère rattaché. Relancez l'analyse des documents de ce type pour qu'ils soient vérifiés."
    );
    expect(linkedCriteriaMessage(2)).toMatch(/^2 critères rattachés\./);
  });

  it("le message de retrait nomme le critère", () => {
    expect(unlinkedCriterionMessage("3.14.2")).toBe("Critère 3.14.2 retiré de ce type de document.");
  });
});
