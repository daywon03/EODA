import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/conversion", () => ({ convertDevisToClient: vi.fn() }));
vi.mock("@/components/etablissement/InviteClientForm", () => ({ InviteClientForm: () => null }));

const { SignatureConversionForm } = await import("./SignatureConversionForm");

// Recette du 13/10/2026 : un refus du serveur (« Ce numéro FINESS est déjà rattaché
// à une fiche client ») vidait FINESS, adresse et échéance HAS saisis, parce que
// React réinitialise un `<form action={fonction}>` après chaque réponse.
describe("SignatureConversionForm", () => {
  const html = renderToStaticMarkup(
    h(SignatureConversionForm, {
      devisId: "devis-1",
      structureName: "SAD Exemple (fictif)",
      contactEmail: null,
      contactName: null,
      existingEstablishmentId: null,
      defaults: {
        establishmentType: null,
        finessNumber: null,
        siretNumber: null,
        address: null,
        hasEvaluationTargetDate: null,
      },
    })
  );

  it("n'est pas un formulaire à action React (qui s'effacerait après un refus)", () => {
    expect(html).not.toContain("React form unexpectedly submitted");
    expect(html).toMatch(/<form[^>]*method="post"/);
  });
});
