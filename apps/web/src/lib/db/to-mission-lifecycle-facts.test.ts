import { describe, expect, it } from "vitest";
import {
  toMissionLifecycleFacts,
  type MissionLifecycleRow,
} from "./to-mission-lifecycle-facts";

function row(overrides: Partial<MissionLifecycleRow> = {}): MissionLifecycleRow {
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

describe("toMissionLifecycleFacts", () => {
  it("rend null sans mission", () => {
    expect(toMissionLifecycleFacts(null)).toBeNull();
  });

  it("compte les dates de phases réellement posées, sur les huit colonnes", () => {
    // Le compte porte sur les huit colonnes de dates : n'en regarder qu'une partie
    // ferait passer pour non démarrée une mission dont seule la dernière phase est
    // planifiée.
    const facts = toMissionLifecycleFacts(
      row({
        fondationsStartDate: new Date("2026-06-01"),
        fondationsEndDate: new Date("2026-08-31"),
        preparationFinaleStartDate: new Date("2026-12-01"),
      })
    );

    expect(facts?.scheduledPhaseDateCount).toBe(3);
  });

  it("ne compte aucune date quand la mission n'est pas planifiée", () => {
    expect(toMissionLifecycleFacts(row())?.scheduledPhaseDateCount).toBe(0);
  });

  it("reprend le compte d'items déjà filtré sur completed par la requête", () => {
    // La requête ramène un COMPTE et non les lignes : seule la longueur servait, et
    // hydrater une trentaine d'objets par mission pour la lire est du volume payé
    // pour rien à chaque ouverture du tableau de bord.
    expect(
      toMissionLifecycleFacts(row({ _count: { itemStatuses: 2 } }))?.completedChecklistCount
    ).toBe(2);
  });

  it("recopie la clôture et la gratuité sans les interpréter", () => {
    const closedAt = new Date("2027-02-01");
    const facts = toMissionLifecycleFacts(row({ closedAt, gratuit: true }));

    expect(facts).toMatchObject({ closedAt, gratuit: true });
  });
});
