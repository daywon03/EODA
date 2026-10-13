import { describe, expect, it } from "vitest";
import { toPortfolioRow, type PortfolioSourceRow } from "./to-portfolio-row";

function missionRow(
  overrides: Partial<PortfolioSourceRow["mission"]> = {}
): NonNullable<PortfolioSourceRow["mission"]> {
  return {
    closedAt: null,
    gratuit: false,
    fondationsStartDate: null,
    fondationsEndDate: null,
    deploiementStartDate: null,
    deploiementEndDate: null,
    consolidationStartDate: null,
    consolidationEndDate: null,
    preparationFinaleStartDate: null,
    preparationFinaleEndDate: null,
    _count: { itemStatuses: 0 },
    ...overrides,
  };
}

describe("toPortfolioRow", () => {
  it("reprend l'échéance HAS", () => {
    const hasEvaluationTargetDate = new Date("2027-01-15");
    expect(toPortfolioRow({ mission: missionRow(), hasEvaluationTargetDate })).toMatchObject({ hasEvaluationTargetDate });
  });

  it("rend une ligne sans mission quand la fiche n'en a pas", () => {
    expect(toPortfolioRow({ mission: null, hasEvaluationTargetDate: null })).toEqual({
      mission: null,
      hasEvaluationTargetDate: null,
    });
  });

  it("traduit les faits de cycle de vie de la mission", () => {
    const row = toPortfolioRow({
      mission: missionRow({
        gratuit: true,
        fondationsStartDate: new Date("2026-09-01"),
        _count: { itemStatuses: 1 },
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
