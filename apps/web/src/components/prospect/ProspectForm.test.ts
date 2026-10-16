import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/actions/prospect", () => ({ createProspect: vi.fn(), updateProspect: vi.fn() }));

const { ProspectForm } = await import("./ProspectForm");

// Recette du 13/10/2026 : un refus (« Précisez le canal “Autre” », FINESS mal formé)
// vidait la fiche prospect saisie au téléphone. L'envoi passe par `onSubmit`
// (submitWithoutReset) : rien n'est effacé après un refus du serveur.
describe("ProspectForm", () => {
  for (const [label, props] of [
    ["création", {}],
    [
      "modification",
      {
        prospect: {
          id: "prospect-1",
          structureName: "SAD Les Glycines (fictif)",
          structureType: "ASSOCIATION",
          finessNumber: null,
          siretNumber: null,
          address: null,
          establishmentType: null,
          hasEvaluationTargetDate: null,
          channel: "AUTRE",
          channelOther: "Salon (fictif)",
          civility: null,
          contactName: null,
          contactRole: null,
          contactRoleOther: null,
          contactPhone: null,
          contactEmail: "contact@example.org",
          envisagedFormule: null,
          estimatedAmountEuros: null,
          firstContactDate: new Date("2026-10-01T00:00:00Z"),
          needsAssessmentNotes: null,
          notes: null,
        },
      },
    ],
  ] as const) {
    it(`${label} : pas de formulaire à action React, envoi en POST`, () => {
      const html = renderToStaticMarkup(h(ProspectForm, props as Parameters<typeof ProspectForm>[0]));
      expect(html).not.toContain("React form unexpectedly submitted");
      expect(html).toMatch(/<form[^>]*method="post"/);
    });
  }
});
