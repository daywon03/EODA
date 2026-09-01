import { describe, expect, it } from "vitest";
import { toPortfolioRow, type PortfolioSourceRow } from "./to-portfolio-row";

function missionRow(
  overrides: Partial<PortfolioSourceRow["mission"]> = {}
): NonNullable<PortfolioSourceRow["mission"]> {
  return {
    closedAt: null,
    gratuit: false,
    formule: "ESSENTIEL",
    fondationsStartDate: null,
    fondationsEndDate: null,
    deploiementStartDate: null,
    deploiementEndDate: null,
    consolidationStartDate: null,
    consolidationEndDate: null,
    preparationFinaleStartDate: null,
    preparationFinaleEndDate: null,
    itemStatuses: [],
    ...overrides,
  };
}

describe("toPortfolioRow", () => {
  it("reprend le statut du prospect, la formule de la mission et l'échéance HAS", () => {
    const hasEvaluationTargetDate = new Date("2027-01-15");

    expect(
      toPortfolioRow({
        prospect: { status: "SIGNE" },
        mission: missionRow({ formule: "EXCELLENCE" }),
        hasEvaluationTargetDate,
      })
    ).toMatchObject({
      prospectStatus: "SIGNE",
      missionFormule: "EXCELLENCE",
      hasEvaluationTargetDate,
    });
  });

  it("rend une ligne sans mission ni formule quand la fiche n'a pas de mission", () => {
    // Pas de repli sur `Establishment.commercialTier`, figé à BETA pour tout le
    // monde : mieux vaut ne rien dire que compter une formule inventée.
    const row = toPortfolioRow({
      prospect: null,
      mission: null,
      hasEvaluationTargetDate: null,
    });

    expect(row).toEqual({
      prospectStatus: null,
      mission: null,
      missionFormule: null,
      hasEvaluationTargetDate: null,
    });
  });

  it("traduit les faits de cycle de vie de la mission", () => {
    const row = toPortfolioRow({
      prospect: { status: "SIGNE" },
      mission: missionRow({
        gratuit: true,
        fondationsStartDate: new Date("2026-09-01"),
        itemStatuses: [{ id: "a" }],
      }),
      hasEvaluationTargetDate: null,
    });

    expect(row.mission).toMatchObject({
      gratuit: true,
      completedChecklistCount: 1,
      scheduledPhaseDateCount: 1,
    });
  });
});
