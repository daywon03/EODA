import { describe, expect, it } from "vitest";
import { planObjectiveLabelRenames, stripObjectiveSuffix } from "@eoda/database/objective-labels";

// Retour du 09/11/2026 (#4) : des intitulés de la liste « Documents » finissent par
// « (Objectif 3.13) », « (Obj. 3.14) »… Le rattachement aux critères vit dans la
// matrice, pas dans le titre. Le script `packages/database/scripts/strip-objective-labels.ts`
// retire ces suffixes ; sa logique est ici, pure, et c'est elle qu'on teste.

describe("stripObjectiveSuffix", () => {
  it.each([
    ["Fiche réflexe chute (Obj. 3.13)", "Fiche réflexe chute"],
    ["Fiche réflexe chute (Obj.3.13)", "Fiche réflexe chute"],
    ["Fiche réflexe chute(Objectif 3.14)", "Fiche réflexe chute"],
    ["Fiche réflexe chute (objectif 3.14)", "Fiche réflexe chute"],
    ["Fiche réflexe chute - Objectif 3.13", "Fiche réflexe chute"],
    ["Fiche réflexe chute – Obj. 3.13", "Fiche réflexe chute"],
    ["Fiche réflexe chute (3.13)", "Fiche réflexe chute"],
    ["Fiche réflexe chute (Objectif 3.13.2)", "Fiche réflexe chute"],
    ["Fiche réflexe chute (Obj. 3.13) (Objectif 3.14)", "Fiche réflexe chute"],
    ["Fiche réflexe chute - Objectif 3.13 (3.14)", "Fiche réflexe chute"],
    ["Fiche réflexe chute (Obj. 3.13)  ", "Fiche réflexe chute"],
  ])("« %s » → « %s »", (label, expected) => {
    expect(stripObjectiveSuffix(label)).toBe(expected);
  });

  it("un titre sans suffixe est rendu tel quel", () => {
    expect(stripObjectiveSuffix("Plan de continuité d'activité")).toBe("Plan de continuité d'activité");
  });

  it("un code de critère au milieu du titre reste intact", () => {
    expect(stripObjectiveSuffix("Procédure 3.13 de gestion des chutes")).toBe("Procédure 3.13 de gestion des chutes");
    expect(stripObjectiveSuffix("Objectif 3.13 : prévenir les chutes")).toBe("Objectif 3.13 : prévenir les chutes");
  });

  it("une parenthèse finale qui n'est pas un objectif reste intacte", () => {
    expect(stripObjectiveSuffix("Directives anticipées (si concerné)")).toBe("Directives anticipées (si concerné)");
    expect(stripObjectiveSuffix("Bilan annuel (2026)")).toBe("Bilan annuel (2026)");
  });

  it("ne vide jamais un titre qui ne serait qu'un suffixe", () => {
    expect(stripObjectiveSuffix("(Objectif 3.13)")).toBe("(Objectif 3.13)");
  });
});

describe("planObjectiveLabelRenames", () => {
  const type = (id: string, label: string, category: "RH" | "LOI_2002_2" | "QUALITE_RISQUES" = "RH") => ({
    id,
    code: `CODE_${id}`,
    label,
    category,
  });

  it("propose ancien → nouveau pour chaque ligne à suffixe, et rien pour les autres (idempotent)", () => {
    const plan = planObjectiveLabelRenames([type("a", "Fiche chute (Obj. 3.13)"), type("b", "Plan de formation")]);
    expect(plan.renames).toEqual([{ id: "a", code: "CODE_a", from: "Fiche chute (Obj. 3.13)", to: "Fiche chute" }]);
    expect(plan.refused).toEqual([]);
    // Rejoué sur le résultat : plus rien à faire.
    expect(planObjectiveLabelRenames([type("a", "Fiche chute"), type("b", "Plan de formation")]).renames).toEqual([]);
  });

  it("refuse un renommage qui créerait un doublon d'intitulé (accents et casse ignorés)", () => {
    const plan = planObjectiveLabelRenames([type("a", "Fiche chute (Obj. 3.13)"), type("b", "fiche CHUTE")]);
    expect(plan.renames).toEqual([]);
    expect(plan.refused).toEqual([
      { id: "a", code: "CODE_a", from: "Fiche chute (Obj. 3.13)", to: "Fiche chute", reason: "Doublon de « fiche CHUTE »." },
    ]);
  });

  it("refuse deux renommages qui aboutiraient au même intitulé", () => {
    const plan = planObjectiveLabelRenames([type("a", "Fiche chute (Obj. 3.13)"), type("b", "Fiche chute (3.14)")]);
    expect(plan.renames).toEqual([]);
    expect(plan.refused.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("ne touche jamais un document de la loi 2002-2 (nom légal, comme renameDocumentType)", () => {
    const plan = planObjectiveLabelRenames([type("a", "Livret d'accueil (Objectif 1.1)", "LOI_2002_2")]);
    expect(plan.renames).toEqual([]);
    expect(plan.refused).toEqual([
      {
        id: "a",
        code: "CODE_a",
        from: "Livret d'accueil (Objectif 1.1)",
        to: "Livret d'accueil",
        reason: "Les documents de la loi 2002-2 gardent leur nom légal.",
      },
    ]);
  });

  it("le journal porte le même texte que renameDocumentType", async () => {
    const { objectiveRenameAuditDetail } = await import("@eoda/database/objective-labels");
    expect(objectiveRenameAuditDetail({ code: "CODE_a", from: "Fiche chute (Obj. 3.13)", to: "Fiche chute" })).toBe(
      "CODE_a : « Fiche chute (Obj. 3.13) » → « Fiche chute »"
    );
  });
});
