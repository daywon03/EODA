import { describe, expect, it } from "vitest";
import { shouldResetAfterSubmit } from "./use-reset-after-success";

describe("shouldResetAfterSubmit", () => {
  it("vide le formulaire à la fin d'un envoi réussi", () => {
    expect(shouldResetAfterSubmit(true, false, true)).toBe(true);
  });

  it("garde la saisie après un refus du serveur", () => {
    expect(shouldResetAfterSubmit(true, false, false)).toBe(false);
  });

  it("ne vide rien au premier rendu (aucun envoi n'a eu lieu)", () => {
    expect(shouldResetAfterSubmit(false, false, true)).toBe(false);
  });

  it("ne vide rien pendant l'envoi", () => {
    expect(shouldResetAfterSubmit(true, true, true)).toBe(false);
    expect(shouldResetAfterSubmit(false, true, true)).toBe(false);
  });
});
