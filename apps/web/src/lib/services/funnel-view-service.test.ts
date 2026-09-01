import { describe, expect, it } from "vitest";
import type { FunnelStage } from "./lifecycle-service";
import {
  biggestDropStage,
  buildFunnelSteps,
  describeFunnel,
  FUNNEL_PROGRESS_STAGES,
} from "./funnel-view-service";

function byStage(overrides: Partial<Record<FunnelStage, number>> = {}): Record<FunnelStage, number> {
  return {
    NOUVEAU: 0,
    RDV: 0,
    DEVIS_ENVOYE: 0,
    NEGOCIATION: 0,
    SIGNE: 0,
    EN_COURS: 0,
    TERMINE: 0,
    PERDU: 0,
    ...overrides,
  };
}

describe("FUNNEL_PROGRESS_STAGES", () => {
  it("exclut PERDU — c'est une sortie, pas une étape", () => {
    expect(FUNNEL_PROGRESS_STAGES).not.toContain("PERDU");
    expect(FUNNEL_PROGRESS_STAGES[0]).toBe("NOUVEAU");
  });
});

describe("buildFunnelSteps", () => {
  it("cumule vers l'amont : une mission en cours a franchi la signature", () => {
    // C'est tout l'objet du service : trois « signés » et douze « en cours » ne sont
    // pas un étranglement à la signature, les douze l'ont franchie.
    const steps = buildFunnelSteps(byStage({ SIGNE: 3, EN_COURS: 12 }));
    const signe = steps.find((step) => step.stage === "SIGNE");
    expect(signe?.current).toBe(3);
    expect(signe?.reached).toBe(15);
  });

  it("calcule le taux de passage entre étapes consécutives", () => {
    const steps = buildFunnelSteps(byStage({ NOUVEAU: 5, RDV: 3, DEVIS_ENVOYE: 2 }));
    // 10 entrées, 5 atteignent RDV → 50 %, puis 2/5 → 40 %.
    expect(steps[0]?.reached).toBe(10);
    expect(steps[0]?.passRatePercent).toBe(50);
    expect(steps[0]?.dropCount).toBe(5);
    expect(steps[1]?.passRatePercent).toBe(40);
  });

  it("ne donne aucun taux de passage sur la dernière étape", () => {
    const steps = buildFunnelSteps(byStage({ TERMINE: 4 }));
    expect(steps[steps.length - 1]?.passRatePercent).toBeNull();
    expect(steps[steps.length - 1]?.dropCount).toBe(0);
  });

  it("ne compte PERDU dans aucune étape — on ignore où l'affaire s'est perdue", () => {
    const steps = buildFunnelSteps(byStage({ NOUVEAU: 2, PERDU: 7 }));
    expect(steps[0]?.reached).toBe(2);
    expect(steps.every((step) => step.reached <= 2)).toBe(true);
  });

  it("rend 0 % et non NaN sur un pipeline vide", () => {
    const steps = buildFunnelSteps(byStage());
    expect(steps.every((step) => step.sharePercent === 0)).toBe(true);
    expect(steps.every((step) => step.passRatePercent === null)).toBe(true);
  });

  it("exprime chaque étape en part de l'entrée", () => {
    const steps = buildFunnelSteps(byStage({ NOUVEAU: 2, SIGNE: 2 }));
    expect(steps[0]?.sharePercent).toBe(100);
    expect(steps.find((step) => step.stage === "SIGNE")?.sharePercent).toBe(50);
  });
});

describe("biggestDropStage", () => {
  it("désigne l'étape où l'on perd le plus", () => {
    const steps = buildFunnelSteps(byStage({ NOUVEAU: 10, RDV: 1, DEVIS_ENVOYE: 4 }));
    expect(biggestDropStage(steps)).toBe("NOUVEAU");
  });

  it("ne désigne rien quand rien ne se perd", () => {
    // Souligner une étape au hasard ferait travailler quelqu'un sur un problème
    // inexistant.
    expect(biggestDropStage(buildFunnelSteps(byStage({ TERMINE: 5 })))).toBeNull();
    expect(biggestDropStage(buildFunnelSteps(byStage()))).toBeNull();
  });
});

describe("describeFunnel", () => {
  const empty = buildFunnelSteps(byStage());

  it("dit le vide autrement qu'avec des zéros", () => {
    expect(describeFunnel({ steps: empty, lost: 0, indetermine: 0 })).toContain("Aucune structure");
  });

  it("compte les entrées, les pertes et les cas indéterminés", () => {
    const steps = buildFunnelSteps(byStage({ NOUVEAU: 3 }));
    const text = describeFunnel({ steps, lost: 2, indetermine: 1 });
    expect(text).toContain("3 structures");
    expect(text).toContain("2 perdues");
    expect(text).toContain("1 sans étape déterminable");
  });

  it("ne mentionne ni pertes ni indéterminés quand il n'y en a pas", () => {
    const steps = buildFunnelSteps(byStage({ NOUVEAU: 1 }));
    const text = describeFunnel({ steps, lost: 0, indetermine: 0 });
    expect(text).not.toContain("perdue");
    expect(text).not.toContain("déterminable");
  });
});
