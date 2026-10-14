import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/devis", () => ({ createDevis: vi.fn(), updateDevis: vi.fn() }));

const { DevisForm } = await import("./DevisForm");

// Recette du 13/10/2026 : un refus du serveur (« Choisissez une offre », acompte hors
// bornes…) effaçait tout le devis en cours — offre, options cochées, note au client —
// parce que React réinitialise un `<form action={fonction}>` après chaque réponse.
// L'envoi passe par `onSubmit` (submitWithoutReset) : la saisie survit au refus.
describe("DevisForm", () => {
  const html = renderToStaticMarkup(
    h(DevisForm, {
      prospectId: "prospect-1",
      formules: [],
      options: [],
      defaultDepositPercent: 30,
      defaultValidityDays: 30,
      structureName: "SAD Les Glycines (fictif)",
    })
  );

  it("n'est pas un formulaire à action React (qui s'effacerait après un refus)", () => {
    expect(html).not.toContain("React form unexpectedly submitted");
  });

  it("ne repart jamais en GET avant hydratation", () => {
    expect(html).toMatch(/<form[^>]*method="post"/);
  });
});
