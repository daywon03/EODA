import { describe, expect, it } from "vitest";
import {
  checkReminderEligibility,
  describeReminderOutcome,
  selectReminderLabels,
  type ReminderCandidate,
} from "./reminder-service";

function candidate(overrides: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    label: "Projet de service",
    status: "MISSING",
    missingJustification: null,
    requestedFromClient: true,
    ...overrides,
  };
}

describe("selectReminderLabels", () => {
  it("relance une pièce réclamée et manquante", () => {
    expect(selectReminderLabels([candidate()])).toEqual(["Projet de service"]);
  });

  it("ne relance pas une pièce déjà justifiée — c'est une réponse, pas un oubli", () => {
    expect(
      selectReminderLabels([candidate({ missingJustification: "Structure non concernée" })])
    ).toEqual([]);
  });

  it("ne relance pas un document que le cabinet doit produire", () => {
    // Le réclamer, c'est remettre au client le travail qu'il a acheté.
    expect(selectReminderLabels([candidate({ requestedFromClient: false })])).toEqual([]);
  });

  it("ne relance pas une pièce déjà déposée", () => {
    expect(selectReminderLabels([candidate({ status: "UPLOADED" })])).toEqual([]);
    expect(selectReminderLabels([candidate({ status: "COMPLIANT" })])).toEqual([]);
  });
});

describe("checkReminderEligibility", () => {
  it("refuse quand plus aucun dépôt n'est possible", () => {
    const result = checkReminderEligibility({ items: [candidate()], depositOpen: false });
    expect(result).toEqual({
      ok: false,
      error:
        "L'accompagnement est terminé : aucun dépôt n'est possible, une relance n'aurait pas de sens.",
    });
  });

  it("refuse quand il n'y a rien à relancer, et le dit autrement", () => {
    const result = checkReminderEligibility({
      items: [candidate({ status: "COMPLIANT" })],
      depositOpen: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("rien à relancer");
  });

  it("rend la liste des pièces à réclamer", () => {
    const result = checkReminderEligibility({
      items: [candidate(), candidate({ label: "DIPC" })],
      depositOpen: true,
    });
    expect(result).toEqual({ ok: true, labels: ["Projet de service", "DIPC"] });
  });
});

describe("describeReminderOutcome", () => {
  it("distingue « personne n'est rattaché » de « envoi échoué »", () => {
    expect(describeReminderOutcome({ sent: 0, total: 0 })).toContain("Aucun interlocuteur");
    expect(describeReminderOutcome({ sent: 0, total: 2 })).toContain("impossible");
  });

  it("dit le nombre réellement joint, même partiel", () => {
    expect(describeReminderOutcome({ sent: 1, total: 3 })).toContain("1 interlocuteur(s) sur 3");
    expect(describeReminderOutcome({ sent: 2, total: 2 })).toContain("2 interlocuteurs");
  });
});
