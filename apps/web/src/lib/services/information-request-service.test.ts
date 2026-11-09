import { describe, expect, it } from "vitest";
import { MAX_ACTION_TITLE_LENGTH } from "./action-item-service";
import { defaultInformationRequestTitle } from "./information-request-service";

// « Demander à la structure » depuis un élément manquant de l'analyse (09/11/2026) :
// la consultante part d'un texte prérempli, qu'elle corrige avant d'envoyer.
describe("defaultInformationRequestTitle", () => {
  it("nomme le document et l'élément attendu", () => {
    expect(defaultInformationRequestTitle("Livret d'accueil", "Les horaires d'ouverture du service")).toBe(
      "Livret d'accueil : compléter « Les horaires d'ouverture du service »"
    );
  });

  it("nettoie les espaces et tient dans la longueur d'une tâche", () => {
    const title = defaultInformationRequestTitle("  Livret   d'accueil ", `${"x".repeat(400)}\n`);
    expect(title.length).toBeLessThanOrEqual(MAX_ACTION_TITLE_LENGTH);
    expect(title.startsWith("Livret d'accueil : compléter « ")).toBe(true);
    expect(title.endsWith("… »")).toBe(true);
  });
});
