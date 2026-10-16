import { describe, expect, it } from "vitest";
import { validateCorrectionProposal } from "@/lib/llm/correction-proposal";
import { buildAnnotatedPlan, changeReportTitle, generateAnnotatedDocx, generateChangeReportDocx } from "./annotated-docx-service";
import { AUTONOMY_RESERVE } from "./review-mention-service";
import { parseInlineRuns } from "./markdown-to-docx-service";

const PROPOSAL = validateCorrectionProposal({
  segments: [
    { kind: "ORIGINAL", text: "# Règlement" },
    { kind: "AJOUT", id: "a1", text: "Permanence [À compléter : horaires].", criterionCode: "3.12.1", reason: "Informer." },
    { kind: "AJOUT", id: "a2", text: "Refusé.", criterionCode: "3.12.2", reason: "Répondre." },
  ],
});
const LABELS = new Map([["3.12.1", "Recueil des plaintes"]]);

// Le run docx expose ses propriétés sous forme de composants XML ; on vérifie la
// présence des balises de surlignage / soulignement dans leur sérialisation.
function runXml(runs: unknown[]): string {
  return JSON.stringify(runs);
}

describe("document annoté (context/10 §4)", () => {
  it("met la mention en tête, garde l'original, surligne les ajouts avec leur encart", () => {
    const plan = buildAnnotatedPlan(PROPOSAL, { labels: LABELS, mention: AUTONOMY_RESERVE });
    expect(plan[0]).toEqual({ kind: "MENTION", text: AUTONOMY_RESERVE });
    expect(plan[1]).toEqual({ kind: "ORIGINAL", markdown: "# Règlement" });
    expect(plan[2]).toMatchObject({
      kind: "ADDITION",
      caption: "Pour le critère : 3.12.1 — Recueil des plaintes",
      insert: "Ajouté car réclamé par le critère HAS 3.12.1, absent de la version initiale.",
    });
    expect(plan.filter((b) => b.kind === "ADDITION")).toHaveLength(2);
  });

  it("après décision : les ajouts acceptés seulement ; sans mention, aucune ligne de mention", () => {
    const plan = buildAnnotatedPlan(PROPOSAL, { labels: LABELS, mention: null, decisions: new Map([["a1", "ACCEPTE"], ["a2", "REFUSE"]]) });
    expect(plan.map((b) => b.kind)).toEqual(["ORIGINAL", "ADDITION"]);
  });

  it("surligne un ajout en vert et un champ à compléter en jaune pointillé", () => {
    expect(runXml(parseInlineRuns("Ajout **gras**", { addition: true }))).toContain('"green"');
    const field = runXml(parseInlineRuns("Tél : [À compléter : astreinte]"));
    expect(field).toContain('"yellow"');
    expect(field).toContain('"dotted"');
    expect(runXml(parseInlineRuns("Texte simple"))).not.toContain('"green"');
  });

  it("produit des .docx valides (signature ZIP)", async () => {
    const annotated = await generateAnnotatedDocx({
      title: "Règlement de fonctionnement",
      establishmentName: "SAD Les Glycines (fictif)",
      plan: buildAnnotatedPlan(PROPOSAL, { labels: LABELS, mention: AUTONOMY_RESERVE }),
    });
    expect(annotated.subarray(0, 2).toString("latin1")).toBe("PK");
    const report = await generateChangeReportDocx({
      documentLabel: "Règlement",
      establishmentName: "SAD Les Glycines (fictif)",
      versionCaption: "Version 1 → version 2.",
      mention: AUTONOMY_RESERVE,
      rows: [{ criterion: "3.12.1", requested: "Informer.", done: "Ajouté", text: "Permanence." }],
    });
    expect(report.subarray(0, 2).toString("latin1")).toBe("PK");
    const empty = await generateChangeReportDocx({ documentLabel: "R", establishmentName: "S", versionCaption: "", mention: null, rows: [] });
    expect(empty.length).toBeGreaterThan(0);
    expect(changeReportTitle("Règlement")).toBe("Rapport des changements — Règlement");
  });
});
