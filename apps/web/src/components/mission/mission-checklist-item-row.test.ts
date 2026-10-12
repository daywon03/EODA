import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Test de bout en bout du 12/10 : les 27 cases de la checklist de mission
// n'avaient aucun nom accessible (le libellé était un <span> voisin). Un lecteur
// d'écran annonçait « case à cocher, non cochée », 27 fois. La case doit être
// dans un vrai <label> qui porte son libellé — cliquer le texte coche aussi.

vi.mock("@/lib/actions/mission", () => ({ toggleChecklistItem: vi.fn() }));

const { MissionChecklistItemRow } = await import("./MissionChecklistItemRow");

describe("MissionChecklistItemRow", () => {
  it("associe la case à cocher à son libellé par un <label>", () => {
    const html = renderToStaticMarkup(
      h(MissionChecklistItemRow, {
        missionId: "m1",
        code: "DIAG_01",
        label: "Recueil des documents existants",
        completed: false,
      })
    );
    expect(html).toMatch(/<label[^>]*>(?:(?!<\/label>).)*<input[^>]*type="checkbox"(?:(?!<\/label>).)*Recueil des documents existants(?:(?!<\/label>).)*<\/label>/s);
  });

  it("annonce le verrou par du texte, pas seulement par l'icône", () => {
    const html = renderToStaticMarkup(
      h(MissionChecklistItemRow, {
        missionId: "m1",
        code: "DIAG_01",
        label: "Recueil des documents existants",
        completed: false,
        locked: true,
      })
    );
    expect(html).toMatch(/hors du périmètre de l/i);
  });
});
