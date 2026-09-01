import { describe, expect, it } from "vitest";
import {
  deriveEstablishmentStage,
  deriveFunnelStage,
  isAccompanimentStarted,
  isBetaMission,
  FUNNEL_STAGE_LABELS,
  FUNNEL_STAGES,
  type MissionLifecycleFacts,
} from "./lifecycle-service";

function mission(overrides: Partial<MissionLifecycleFacts> = {}): MissionLifecycleFacts {
  return {
    closedAt: null,
    gratuit: false,
    completedChecklistCount: 0,
    scheduledPhaseDateCount: 0,
    ...overrides,
  };
}

const CLOSED_ON = new Date("2027-02-01T00:00:00Z");

describe("deriveEstablishmentStage", () => {
  it("rend SIGNE tant que rien n'a démarré", () => {
    expect(deriveEstablishmentStage(mission())).toBe("SIGNE");
  });

  it("passe EN_COURS dès le premier item de diagnostic coché", () => {
    expect(deriveEstablishmentStage(mission({ completedChecklistCount: 1 }))).toBe("EN_COURS");
  });

  it("passe EN_COURS dès qu'une date de phase est posée, même sans item coché", () => {
    // Sandrine planifie souvent les phases avant de cocher quoi que ce soit : ne
    // regarder que la checklist afficherait « Signé » sur une mission déjà calée.
    expect(deriveEstablishmentStage(mission({ scheduledPhaseDateCount: 1 }))).toBe("EN_COURS");
  });

  it("rend null sans mission — jamais une étape par défaut", () => {
    // Renvoyer « SIGNE » ferait passer pour cliente une structure qui n'a rien signé.
    expect(deriveEstablishmentStage(null)).toBeNull();
  });
});

// L'invariant le plus important du module : clôture ≠ complétude.
describe("clôture et progression sont indépendantes", () => {
  it("ne clôt PAS une mission dont toute la checklist est cochée", () => {
    // Une mission entièrement cochée reste ouverte jusqu'à la visite des évaluateurs
    // HAS. La clore automatiquement fermerait le portail du client avant l'échéance
    // pour laquelle il a payé.
    const complete = mission({ completedChecklistCount: 12, scheduledPhaseDateCount: 8 });

    expect(deriveEstablishmentStage(complete)).toBe("EN_COURS");
  });

  it("clôt une mission abandonnée en cours de route", () => {
    // Cas inverse : closedAt posé alors que la progression est partielle.
    const abandoned = mission({ closedAt: CLOSED_ON, completedChecklistCount: 3 });

    expect(deriveEstablishmentStage(abandoned)).toBe("TERMINE");
  });

  it("clôt même une mission qui n'a jamais démarré", () => {
    expect(deriveEstablishmentStage(mission({ closedAt: CLOSED_ON }))).toBe("TERMINE");
  });
});

describe("isBetaMission", () => {
  it.each(["signée", "en cours", "terminée"] as const)(
    "reste vrai sur une mission %s — c'est un attribut, pas une étape",
    (_libelle) => {
      const cases = [
        mission({ gratuit: true }),
        mission({ gratuit: true, completedChecklistCount: 4 }),
        mission({ gratuit: true, closedAt: CLOSED_ON }),
      ];
      for (const m of cases) expect(isBetaMission(m)).toBe(true);
    }
  );

  it("est faux sur une mission payante et sans mission du tout", () => {
    expect(isBetaMission(mission())).toBe(false);
    expect(isBetaMission(null)).toBe(false);
  });
});

describe("deriveFunnelStage", () => {
  it("suit le prospect tant qu'aucune mission n'existe", () => {
    expect(deriveFunnelStage({ prospectStatus: "NEGOCIATION", mission: null })).toBe("NEGOCIATION");
  });

  it("laisse la mission l'emporter sur un prospect resté à SIGNE", () => {
    // Prospect.status reste figé à SIGNE après conversion — correct comme dernier
    // état commercial, mais muet sur l'accompagnement. Le lire en priorité
    // afficherait « Signé » sur une mission terminée depuis six mois.
    expect(
      deriveFunnelStage({
        prospectStatus: "SIGNE",
        mission: mission({ closedAt: CLOSED_ON }),
      })
    ).toBe("TERMINE");
  });

  it("dérive de la seule mission pour une fiche sans prospect", () => {
    // ASSAD BENOIT : créé à la main avant l'entonnoir unique, aucun prospect rattaché.
    expect(
      deriveFunnelStage({ prospectStatus: null, mission: mission({ completedChecklistCount: 11 }) })
    ).toBe("EN_COURS");
  });

  it("conserve PERDU tant qu'aucune mission ne le contredit", () => {
    expect(deriveFunnelStage({ prospectStatus: "PERDU", mission: null })).toBe("PERDU");
  });

  it("rend null quand on ne sait rien — jamais une étape inventée", () => {
    expect(deriveFunnelStage({ prospectStatus: null, mission: null })).toBeNull();
  });
});

describe("isAccompanimentStarted", () => {
  it("distingue une fiche signée d'un accompagnement réellement commencé", () => {
    expect(isAccompanimentStarted("SIGNE")).toBe(false);
    expect(isAccompanimentStarted("EN_COURS")).toBe(true);
    expect(isAccompanimentStarted("TERMINE")).toBe(true);
    expect(isAccompanimentStarted(null)).toBe(false);
  });
});

describe("libellés", () => {
  it("traduit toutes les étapes — aucun nom technique à l'écran", () => {
    for (const stage of FUNNEL_STAGES) {
      expect(FUNNEL_STAGE_LABELS[stage]).toBeTruthy();
      expect(FUNNEL_STAGE_LABELS[stage]).not.toBe(stage);
    }
  });
});
