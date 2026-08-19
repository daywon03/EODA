import { describe, expect, it } from "vitest";
import { anonymizeText } from "./anonymization-service";
import { deriveDocumentStatus } from "./document-status-service";
import { shouldSuggestCompliance } from "./pre-rating-suggestion-service";
import { suggestDocumentType } from "./document-categorization-service";

// Chaîne d'analyse documentaire (Module 1). L'anonymisation est une contrainte RGPD :
// ce qui passe ici part vers un service externe.

describe("anonymizeText — masquage avant appel LLM externe", () => {
  it("masque une adresse email", () => {
    const result = anonymizeText("Contact : julien.chevalier@exemple.fr pour toute question.");
    expect(result).not.toContain("julien.chevalier@exemple.fr");
    expect(result).toContain("[email masqué]");
  });

  it("masque un numéro de téléphone français dans ses formats courants", () => {
    for (const phone of ["0612345678", "06 12 34 56 78", "06.12.34.56.78", "+33 6 12 34 56 78"]) {
      const result = anonymizeText(`Joignable au ${phone}.`);
      expect(result).toContain("[téléphone masqué]");
      expect(result).not.toContain(phone);
    }
  });

  it("masque un numéro de sécurité sociale", () => {
    const result = anonymizeText("NIR : 1 85 12 75 116 001 42");
    expect(result).toContain("[NIR masqué]");
    expect(result).not.toContain("116 001");
  });

  it("masque plusieurs occurrences dans le même texte", () => {
    const result = anonymizeText("a@b.fr puis c@d.fr");
    expect(result).toBe("[email masqué] puis [email masqué]");
  });

  it("laisse intact un texte sans donnée personnelle", () => {
    const text = "Le livret d'accueil mentionne la charte des droits et libertés.";
    expect(anonymizeText(text)).toBe(text);
  });

  it("gère une chaîne vide sans échouer", () => {
    expect(anonymizeText("")).toBe("");
  });
});

describe("deriveDocumentStatus", () => {
  it("déclare COMPLIANT seulement si le verdict est positif ET qu'aucun élément ne manque", () => {
    expect(
      deriveDocumentStatus({
        sembleConforme: true,
        elementsManquants: [],
        elementsPresents: ["charte"],
        suggestionsCorrection: [],
      })
    ).toBe("COMPLIANT");
  });

  it("déclare INCOMPLETE si un élément manque, même quand le verdict est positif", () => {
    // Cas ambigu volontairement tranché du côté prudent : un manque signalé prime sur
    // un verdict global optimiste.
    expect(
      deriveDocumentStatus({
        sembleConforme: true,
        elementsManquants: ["mention du CVS"],
        elementsPresents: [],
        suggestionsCorrection: [],
      })
    ).toBe("INCOMPLETE");
  });

  it("déclare INCOMPLETE si le verdict est négatif", () => {
    expect(
      deriveDocumentStatus({
        sembleConforme: false,
        elementsManquants: [],
        elementsPresents: [],
        suggestionsCorrection: [],
      })
    ).toBe("INCOMPLETE");
  });
});

describe("shouldSuggestCompliance — pont Module 1 → Module 3", () => {
  it("suggère quand tous les documents rattachés sont conformes", () => {
    expect(shouldSuggestCompliance(["COMPLIANT", "COMPLIANT"])).toBe(true);
  });

  it("ne suggère rien dès qu'un document n'est pas conforme", () => {
    expect(shouldSuggestCompliance(["COMPLIANT", "INCOMPLETE"])).toBe(false);
    expect(shouldSuggestCompliance(["COMPLIANT", "MISSING"])).toBe(false);
  });

  it("ne suggère rien en l'absence de document rattaché — pas de cotation par défaut", () => {
    expect(shouldSuggestCompliance([])).toBe(false);
  });
});

describe("suggestDocumentType — catégorisation heuristique", () => {
  const candidates = [
    { id: "1", code: "L2002_LIVRET_ACCUEIL", label: "Livret d'accueil" },
    { id: "2", code: "L2002_DIPC", label: "Document individuel de prise en charge" },
    { id: "3", code: "RH_LIVRET_ACCUEIL_SALARIE", label: "Livret d'accueil salarié" },
  ];

  it("reconnaît un type depuis le nom de fichier", () => {
    expect(suggestDocumentType(candidates, "20260408_livret_accueil_v02.pdf")?.documentTypeId).toBe(
      "1"
    );
  });

  it("est insensible aux accents et à la casse", () => {
    expect(suggestDocumentType(candidates, "LIVRET-D'ACCUEIL.pdf")?.documentTypeId).toBe("1");
  });

  it("exploite le texte extrait quand le nom de fichier n'est pas parlant", () => {
    const suggestion = suggestDocumentType(
      candidates,
      "scan001.pdf",
      "Document individuel de prise en charge de la personne accompagnée"
    );
    expect(suggestion?.documentTypeId).toBe("2");
  });

  it("ne suggère rien plutôt que de deviner sur une correspondance trop faible", () => {
    expect(suggestDocumentType(candidates, "photo-vacances.pdf")).toBeNull();
    expect(suggestDocumentType(candidates, "")).toBeNull();
  });

  it("renvoie un score exploitable pour arbitrer entre deux candidats proches", () => {
    const suggestion = suggestDocumentType(candidates, "livret accueil salarie.pdf");
    expect(suggestion).not.toBeNull();
    expect(suggestion!.score).toBeGreaterThan(0.2);
  });

  it("ne suggère rien sans candidat", () => {
    expect(suggestDocumentType([], "livret_accueil.pdf")).toBeNull();
  });
});
