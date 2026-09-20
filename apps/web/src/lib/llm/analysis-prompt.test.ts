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

describe("buildSystemPrompt — garde-fous de la revue humaine", () => {
  it("interdit explicitement de conclure à la conformité de l'établissement", () => {
    expect(buildSystemPrompt()).toContain("Ne conclus jamais qu'une structure est conforme");
  });

  it("demande de signaler l'incertitude plutôt que de trancher", () => {
    expect(buildSystemPrompt()).toMatch(/incertitude|doute/i);
  });
});
