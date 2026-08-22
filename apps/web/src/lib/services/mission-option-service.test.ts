import { describe, expect, it } from "vitest";
import {
  reconcileMissionOptions,
  summariseMissionScopeForAudit,
  toMissionOptionSnapshotsFromCatalogue,
  type CatalogueOptionForMission,
} from "./mission-option-service";

function catalogueOption(
  overrides: Partial<CatalogueOptionForMission> = {}
): CatalogueOptionForMission {
  return {
    id: "opt-kpi",
    label: "Tableau de bord 24 KPI",
    priceEuros: 1200,
    pricingUnit: "FORFAIT",
    priceMaxEuros: null,
    minQuantity: null,
    ...overrides,
  };
}

describe("toMissionOptionSnapshotsFromCatalogue", () => {
  it("marque le prix comme NON ferme — c'est un « à partir de » du catalogue", () => {
    // L'invariant central de ce module. Une option rattachée à la main n'a pas de
    // devis derrière elle : présenter son prix comme ferme au portail client
    // annoncerait un engagement contractuel qui n'existe pas.
    const [snapshot] = toMissionOptionSnapshotsFromCatalogue([catalogueOption()]);

    expect(snapshot?.priceIsFirm).toBe(false);
  });

  it("fige le libellé et le prix du catalogue au moment du rattachement", () => {
    // Snapshot et non référence : une hausse de tarif ne doit pas réécrire
    // rétroactivement le périmètre d'une mission en cours.
    expect(toMissionOptionSnapshotsFromCatalogue([catalogueOption()])).toEqual([
      {
        catalogueOptionId: "opt-kpi",
        labelSnapshot: "Tableau de bord 24 KPI",
        priceSnapshotEuros: 1200,
        pricingUnitSnapshot: "FORFAIT",
        priceMaxSnapshotEuros: null,
        minQuantitySnapshot: null,
        priceIsFirm: false,
      },
    ]);
  });

  it("conserve l'unité, la borne haute et le minimum facturable", () => {
    const [snapshot] = toMissionOptionSnapshotsFromCatalogue([
      catalogueOption({
        id: "opt-doc",
        pricingUnit: "HEURE",
        priceEuros: 95,
        priceMaxEuros: 120,
        minQuantity: 2,
      }),
    ]);

    expect(snapshot).toMatchObject({
      pricingUnitSnapshot: "HEURE",
      priceSnapshotEuros: 95,
      priceMaxSnapshotEuros: 120,
      minQuantitySnapshot: 2,
    });
  });

  it("renvoie une liste vide sans rien inventer", () => {
    expect(toMissionOptionSnapshotsFromCatalogue([])).toEqual([]);
  });
});

describe("reconcileMissionOptions", () => {
  it("distingue ce qu'il faut ajouter, retirer et laisser tel quel", () => {
    expect(
      reconcileMissionOptions({ current: ["a", "b"], selected: ["b", "c"] })
    ).toEqual({ toAdd: ["c"], toRemove: ["a"], unchanged: ["b"] });
  });

  it("ne touche pas à une option déjà rattachée et toujours cochée", () => {
    // Le point qui compte : la réécrire recopierait le prix COURANT du catalogue
    // par-dessus un snapshot existant — c'est-à-dire modifier un montant déjà
    // communiqué au client, potentiellement un montant ferme issu d'un devis.
    const result = reconcileMissionOptions({ current: ["a"], selected: ["a"] });

    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
    expect(result.unchanged).toEqual(["a"]);
  });

  it("vide le périmètre quand plus rien n'est coché", () => {
    expect(reconcileMissionOptions({ current: ["a", "b"], selected: [] })).toMatchObject({
      toAdd: [],
      toRemove: ["a", "b"],
    });
  });

  it("dédoublonne une sélection envoyée deux fois", () => {
    // Un formulaire bricolé peut renvoyer deux fois la même case. Sans déduplication
    // ici, l'insertion s'appuierait sur skipDuplicates pour rattraper une entrée
    // malformée — c'est-à-dire sur la base pour corriger un défaut applicatif.
    expect(reconcileMissionOptions({ current: [], selected: ["a", "a", "b"] })).toMatchObject({
      toAdd: ["a", "b"],
    });
  });

  it("ignore un identifiant déjà présent envoyé en double", () => {
    expect(reconcileMissionOptions({ current: ["a"], selected: ["a", "a"] })).toEqual({
      toAdd: [],
      toRemove: [],
      unchanged: ["a"],
    });
  });
});

describe("summariseMissionScopeForAudit", () => {
  it("ne contient que des clés techniques, jamais de donnée nominative", () => {
    expect(
      summariseMissionScopeForAudit({ formule: "ESSENTIEL", gratuit: false, optionCount: 2 })
    ).toBe("ESSENTIEL · 2 option(s)");
  });

  it("signale une mission gratuite, qui ouvre un périmètre sans contrepartie", () => {
    expect(
      summariseMissionScopeForAudit({ formule: "EXCELLENCE", gratuit: true, optionCount: 0 })
    ).toBe("EXCELLENCE · 0 option(s) · gratuit");
  });
});
