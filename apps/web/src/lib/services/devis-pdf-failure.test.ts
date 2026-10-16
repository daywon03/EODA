import { describe, expect, it } from "vitest";
import { DevisPdfError, devisPdfFailureMessage } from "@/lib/services/devis-pdf-failure";

// Test de bout en bout du 12/10 : quand Chromium ne pouvait pas s'exécuter (poste
// local), l'écran disait « Réessayez dans un instant » — réessayer donnait le même
// échec. Le message dépend désormais de la cause.
describe("devisPdfFailureMessage", () => {
  it("Chromium ne démarre pas : ne propose jamais de réessayer", () => {
    const text = devisPdfFailureMessage(new DevisPdfError("LAUNCH", new Error("spawn ENOENT")));
    expect(text).toMatch(/Chromium/);
    expect(text).toMatch(/Télécharger/);
    expect(text).not.toMatch(/Réessayez/);
  });

  it("délai dépassé : réessayer a un sens", () => {
    expect(devisPdfFailureMessage(new DevisPdfError("TIMEOUT"))).toMatch(
      /Réessayez dans un instant/
    );
  });

  it("page imprimable inaccessible : renvoie vers « Télécharger » pour vérifier", () => {
    const text = devisPdfFailureMessage(new DevisPdfError("PAGE"));
    expect(text).toMatch(/page imprimable/);
    expect(text).not.toMatch(/Réessayez/);
  });

  it("erreur inconnue (pas une DevisPdfError) : message générique sans promesse", () => {
    const text = devisPdfFailureMessage(new Error("boom"));
    expect(text).toMatch(/erreur inattendue/);
    expect(text).not.toMatch(/Réessayez/);
    expect(text).not.toMatch(/boom/);
  });

  it("garde la cause d'origine pour le journal serveur", () => {
    const cause = new Error("spawn ENOENT");
    const error = new DevisPdfError("LAUNCH", cause);
    expect(error.stage).toBe("LAUNCH");
    expect(error.cause).toBe(cause);
    expect(error.name).toBe("DevisPdfError");
  });
});
