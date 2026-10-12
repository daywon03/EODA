import { describe, expect, it } from "vitest";
import { validateCorrectionProposal } from "@/lib/llm/correction-proposal";
import {
  additionInsert,
  buildChangeReport,
  buildDecisionsRecord,
  canUseComplianceWorkspace,
  countDecisions,
  countFieldsToComplete,
  criterionCaption,
  describeProposalStatus,
  extractFieldsToComplete,
  nextVersionLabel,
  parseDecisions,
  proposalToMarkdown,
  readDecisionsRecord,
  splitFields,
  type ProposalDecision,
} from "./correction-proposal-service";

const PROPOSAL = validateCorrectionProposal({
  segments: [
    { kind: "ORIGINAL", text: "## Article 1\nNuméro FINESS : [À compléter : FINESS]" },
    { kind: "AJOUT", id: "a1", text: "Permanence de [À compléter : horaires].", criterionCode: "3.12.1", reason: "Informer la personne.", manualQuote: "Le service informe" },
    { kind: "ORIGINAL", text: "Article 2" },
    { kind: "AJOUT", id: "a2", text: "Réclamation sous 15 jours.", criterionCode: "", reason: "Plaintes." },
  ],
});
const LABELS = new Map([["3.12.1", "Recueil des plaintes"]]);
const decisions = (entries: [string, ProposalDecision][]) => new Map(entries);

describe("décisions par ajout", () => {
  it("valide les décisions reçues du navigateur", () => {
    expect(parseDecisions({ a1: "ACCEPTE", a2: "REFUSE" }, PROPOSAL)).toMatchObject({ ok: true });
    expect(parseDecisions({}, PROPOSAL)).toMatchObject({ ok: true });
    expect(parseDecisions({ a9: "ACCEPTE" }, PROPOSAL)).toMatchObject({ ok: false });
    expect(parseDecisions({ a1: "accepte" }, PROPOSAL)).toMatchObject({ ok: false });
    expect(parseDecisions(["a1"], PROPOSAL)).toMatchObject({ ok: false });
    expect(parseDecisions(null, PROPOSAL)).toMatchObject({ ok: false });
  });

  it("la version N+1 = l'original + les ajouts ACCEPTÉS seulement ; sans décision, rien n'entre", () => {
    const md = proposalToMarkdown(PROPOSAL, decisions([["a1", "ACCEPTE"], ["a2", "REFUSE"]]));
    expect(md).toContain("Permanence");
    expect(md).not.toContain("Réclamation");
    expect(md).toContain("Article 2");
    expect(proposalToMarkdown(PROPOSAL, new Map())).not.toContain("Permanence");
    expect(proposalToMarkdown(PROPOSAL)).toContain("Réclamation");
  });

  it("compte et décrit", () => {
    expect(countDecisions(PROPOSAL, decisions([["a1", "ACCEPTE"]]))).toEqual({ total: 2, accepted: 1, refused: 0, pending: 1 });
    expect(describeProposalStatus(PROPOSAL, new Map())).toBe("2 ajouts à vérifier. 2 champs à compléter.");
    expect(describeProposalStatus(PROPOSAL, decisions([["a1", "ACCEPTE"], ["a2", "REFUSE"]]))).toBe(
      "Tous les ajouts sont vérifiés. 2 champs à compléter."
    );
    expect(countFieldsToComplete(PROPOSAL, new Map())).toBe(1);
    expect(nextVersionLabel(1)).toBe("Enregistrer la version 2");
  });

  it("la trace stockée se relit à l'identique, et une trace illisible ne décide rien", () => {
    const map = decisions([["a1", "ACCEPTE"], ["a2", "REFUSE"]]);
    const record = buildDecisionsRecord(map, new Date("2026-10-12T10:00:00Z"));
    expect(record.decidedAt).toBe("2026-10-12T10:00:00.000Z");
    expect(readDecisionsRecord(JSON.parse(JSON.stringify(record)))).toEqual(map);
    expect(readDecisionsRecord(null).size).toBe(0);
    expect(readDecisionsRecord({ decisions: [{ id: "a1", decision: "PEUT-ETRE" }, "x"] }).size).toBe(0);
  });
});

describe("champs à compléter", () => {
  it("les repère et découpe le texte pour l'affichage en pointillé", () => {
    expect(extractFieldsToComplete("A [À compléter : x] B [À compléter par la structure : y]")).toHaveLength(2);
    expect(extractFieldsToComplete("rien")).toEqual([]);
    expect(splitFields("Tél : [À compléter : astreinte] ok")).toEqual([
      { kind: "text", value: "Tél : " },
      { kind: "field", value: "[À compléter : astreinte]" },
      { kind: "text", value: " ok" },
    ]);
  });
});

describe("phrases et rapport des changements", () => {
  it("« Pour le critère : X » et l'encart « ajouté car réclamé par le critère X »", () => {
    const [a1, a2] = PROPOSAL.segments.filter((s) => s.kind === "AJOUT");
    if (a1?.kind !== "AJOUT" || a2?.kind !== "AJOUT") throw new Error("fixture");
    expect(criterionCaption(a1, LABELS)).toBe("Pour le critère : 3.12.1 — Recueil des plaintes");
    expect(criterionCaption(a2, LABELS)).toBe("Pour le critère : à identifier");
    expect(criterionCaption({ ...a1, criterionCode: "9.9.9" }, LABELS)).toBe("Pour le critère : 9.9.9");
    expect(additionInsert(a1)).toBe(
      "Ajouté car réclamé par le critère HAS 3.12.1, absent de la version initiale. Manuel HAS : « Le service informe »"
    );
    expect(additionInsert(a2)).toMatch(/^Ajouté pour compléter le document/);
  });

  it("dit ce qui était demandé et ce qui a été fait, ajout par ajout", () => {
    const report = buildChangeReport(PROPOSAL, decisions([["a1", "ACCEPTE"]]), LABELS);
    expect(report).toEqual([
      { criterion: "3.12.1 — Recueil des plaintes", requested: "Informer la personne.", done: "Ajouté", text: "Permanence de [À compléter : horaires]." },
      { criterion: "à identifier", requested: "Plaintes.", done: "Non retenu", text: "Réclamation sous 15 jours." },
    ]);
    expect(buildChangeReport(PROPOSAL, decisions([["a2", "REFUSE"]]), LABELS)[1]!.done).toBe("Refusé");
  });
});

describe("qui ouvre l'écran côte à côte", () => {
  it("cabinet toujours ; structure seulement en autonomie ET avec le droit", () => {
    expect(canUseComplianceWorkspace({ isClient: false, mode: "ACCOMPAGNE", rightIncluded: false })).toBe(true);
    expect(canUseComplianceWorkspace({ isClient: true, mode: "AUTONOMIE", rightIncluded: true })).toBe(true);
    expect(canUseComplianceWorkspace({ isClient: true, mode: "AUTONOMIE", rightIncluded: false })).toBe(false);
    expect(canUseComplianceWorkspace({ isClient: true, mode: "ACCOMPAGNE", rightIncluded: true })).toBe(false);
  });
});
