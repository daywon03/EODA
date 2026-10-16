import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/self-service", () => ({ signUpSelfService: vi.fn() }));

const { SignupForm } = await import("./SignupForm");

// Défaut trouvé en recette de bout en bout (13/10/2026) : le formulaire était branché
// en `<form action={formAction}>`. React réinitialise alors le formulaire après chaque
// réponse de l'action — y compris une erreur : prénom, e-mail et mot de passe effacés,
// et les boutons radio des étapes 1 et 2 décochés dans le DOM alors que l'état React
// les croyait cochés. Le second envoi échouait sur « Choisissez le type de service »,
// une étape que la personne avait remplie. L'envoi passe donc par `onSubmit` : rien
// n'est effacé après une erreur.
describe("SignupForm", () => {
  const html = renderToStaticMarkup(
    h(SignupForm, { prices: { ESSENTIEL: null, PERFORMANCE: null, EXCELLENCE: null }, initialOffer: "PERFORMANCE" })
  );

  it("n'est pas un formulaire à action React (qui s'effacerait après une erreur)", () => {
    // Signature du rendu d'un `<form action={fonction}>` par React.
    expect(html).not.toContain("React form unexpectedly submitted");
  });

  it("ne repart jamais en GET (le mot de passe finirait dans l'adresse)", () => {
    expect(html).toMatch(/<form[^>]*method="post"/);
  });

  it("le bouton « Continuer » n'envoie pas le formulaire", () => {
    expect(html).toMatch(/<button type="button"[^>]*>Continuer<\/button>/);
  });
});
