import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "./analysis-prompt";

// L'adjoint IA qualité ne doit jamais confondre un dépôt client (à lire tel quel)
// et une version déjà retravaillée par le cabinet (jugeable plus strictement) —
// verrouille que le prompt utilisateur porte bien cette distinction quand elle est
// connue, et reste silencieux quand elle ne l'est pas (analyses stockées avant ce
// champ, cf. commentaire sur `documentOrigin` dans llm-analysis-port.ts).
describe("buildUserMessage — origine du document", () => {
  const base = {
    documentTypeLabel: "Livret d'accueil",
    extractedText: "Contenu du document.",
    linkedCriteria: [],
  };

  it("précise une origine CLIENT — à lire tel quel", () => {
    const message = buildUserMessage({ ...base, documentOrigin: "CLIENT" });
    expect(message).toContain("déposé par le client");
  });

  it("précise une origine CABINET — jugeable plus strictement", () => {
    const message = buildUserMessage({ ...base, documentOrigin: "CABINET" });
    expect(message).toContain("produit ou retravaillé par le cabinet");
  });

  it("ne mentionne aucune origine quand elle est absente (analyses stockées avant ce champ)", () => {
    const message = buildUserMessage(base);
    expect(message).not.toContain("Origine :");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LA LIGNE DES CRITÈRES RATTACHÉS (16/10/2026) — le maillon « matrice → IA ».
//
// `DocumentTypeCriterion` est le levier n°1 de la qualité des analyses (spec 04) :
// Sandrine rattache des critères HAS à un type de document, et l'analyse juge la pièce
// au regard de CES critères. Rien ne le prouvait : la chaîne complète fonctionnait
// (lecture en base → port d'analyse → prompt) mais aucun test ne la verrouillait —
// supprimer la ligne ci-dessous, ou le `findMany` qui l'alimente, passait au vert.
//
// Ce qui est verrouillé ici, c'est le RENDU ; le test qui prouve que la lecture en base
// alimente bien ce champ est dans document-ingestion-service.test.ts, parce que c'est
// là que la matrice est lue.
describe("buildUserMessage — critères HAS rattachés au type de document", () => {
  const base = {
    documentTypeLabel: "Projet de service",
    extractedText: "Contenu du document.",
  };

  it("inscrit chaque critère rattaché, code et intitulé", () => {
    const message = buildUserMessage({
      ...base,
      linkedCriteria: [
        { code: "1.2.1", label: "Exercice des droits" },
        { code: "3.12.1", label: "Traitement des plaintes" },
      ],
    });

    expect(message).toContain(
      "Critères HAS rattachés à ce type de document : 1.2.1 — Exercice des droits ; 3.12.1 — Traitement des plaintes"
    );
  });

  it("dit explicitement qu'aucun rattachement n'est connu, sans laisser la ligne vide", () => {
    // Cas RÉEL aujourd'hui : la matrice est vide pour la plupart des types. Le modèle
    // doit lire une phrase, pas une valeur absente — une ligne vide se lirait comme une
    // consigne tronquée, et l'analyse jugerait alors sans référentiel.
    const message = buildUserMessage({ ...base, linkedCriteria: [] });

    expect(message).toContain("Critères HAS rattachés à ce type de document : aucun rattachement connu");
    expect(message).not.toContain("undefined");
    expect(message).not.toContain("null");
  });
});

describe("buildSystemPrompt — garde-fous de la revue humaine", () => {
  it("interdit explicitement de conclure à la conformité de l'établissement", () => {
    expect(buildSystemPrompt()).toContain("Ne conclus jamais qu'une structure est conforme");
  });

  it("demande de signaler l'incertitude plutôt que de trancher", () => {
    expect(buildSystemPrompt()).toMatch(/incertitude|doute/i);
  });
});
