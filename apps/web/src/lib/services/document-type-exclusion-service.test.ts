import { describe, expect, it } from "vitest";
import {
  hideForEstablishmentError,
  removalChoices,
  withoutHiddenTypes,
} from "./document-type-exclusion-service";

// Retour de Sandrine (10/11/2026) : « il y a des doublons ou des lignes qui ne sont
// plus nécessaires — une petite poubelle, et demander si on supprime seulement pour ce
// client ou pour tout le monde ».

describe("hideForEstablishmentError — masquer une ligne pour UNE structure", () => {
  it("accepte une ligne sans dépôt, hors loi 2002-2", () => {
    expect(hideForEstablishmentError({ category: "QUALITE_RISQUES", hasDeposit: false })).toBeNull();
  });

  it("refuse la loi 2002-2 : ces documents sont obligatoires pour toute structure", () => {
    expect(hideForEstablishmentError({ category: "LOI_2002_2", hasDeposit: false })).toMatch(/loi 2002-2/);
  });

  it("refuse une ligne qui porte un dépôt : on ne cache pas une pièce", () => {
    expect(hideForEstablishmentError({ category: "RH", hasDeposit: true })).toMatch(/déposée/);
  });
});

describe("removalChoices — ce que la poubelle propose", () => {
  it("ligne du cabinet sans dépôt : les deux portées", () => {
    expect(
      removalChoices({ category: "QUALITE_RISQUES", hasDeposit: false, removableForEveryone: true })
    ).toEqual({ forThisStructure: true, forEveryone: true });
  });

  it("ligne du référentiel : seulement pour cette structure", () => {
    expect(
      removalChoices({ category: "QUALITE_RISQUES", hasDeposit: false, removableForEveryone: false })
    ).toEqual({ forThisStructure: true, forEveryone: false });
  });

  it("loi 2002-2 : aucune poubelle", () => {
    expect(removalChoices({ category: "LOI_2002_2", hasDeposit: false, removableForEveryone: false })).toEqual({
      forThisStructure: false,
      forEveryone: false,
    });
  });
});

describe("withoutHiddenTypes — les documents attendus d'une structure", () => {
  it("retire les lignes masquées pour cette structure, garde l'ordre", () => {
    expect(withoutHiddenTypes(["a", "b", "c"], new Set(["b"]))).toEqual(["a", "c"]);
  });
});
