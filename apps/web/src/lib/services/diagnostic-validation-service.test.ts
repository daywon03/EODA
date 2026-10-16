import { describe, expect, it } from "vitest";
import { buildDiagnosticSnapshot, diagnosticFingerprint } from "./diagnostic-service";
import type { CriterionProofRow } from "./criteria-proof-service";
import {
  AUTONOMY_NO_REVIEW_MESSAGE,
  CHANGED_SINCE_REVIEW_MESSAGE,
  NOT_REVIEWED_YET_MESSAGE,
  decideClientAcceptance,
  decideEodaReview,
  describeDiagnosticValidation,
  isValidationCurrent,
  type DiagnosticValidationFacts,
} from "./diagnostic-validation-service";
import { AUTONOMY_RESERVE } from "./review-mention-service";

const BASE: CriterionProofRow = {
  id: "c1",
  code: "3.12.1",
  label: "Plaintes",
  chapterNumber: 3,
  isImperative: true,
  expectedDocumentTypeIds: ["t"],
  status: "SANS_PREUVE",
  expected: 1,
  deposited: 0,
  proven: 0,
};
const LIVE = [BASE];
const LIVE_FP = diagnosticFingerprint(LIVE);
const CHANGED_FP = diagnosticFingerprint([{ ...BASE, status: "PROUVE" }]);
const REVIEWED = new Date(2026, 9, 5, 10);
const ACCEPTED = new Date(2026, 9, 6, 10);

function validation(overrides: Partial<DiagnosticValidationFacts> = {}): DiagnosticValidationFacts {
  return {
    id: "v1",
    snapshotJson: buildDiagnosticSnapshot(LIVE, REVIEWED),
    reviewedByEodaAt: null,
    acceptedByClientAt: null,
    ...overrides,
  };
}

describe("isValidationCurrent", () => {
  it("vrai si la photo a la même empreinte que le diagnostic courant", () => {
    expect(isValidationCurrent(validation(), LIVE_FP)).toBe(true);
    expect(isValidationCurrent(validation(), CHANGED_FP)).toBe(false);
    expect(isValidationCurrent(null, LIVE_FP)).toBe(false);
    expect(isValidationCurrent(validation({ snapshotJson: { illisible: true } }), LIVE_FP)).toBe(false);
  });
});

describe("geste du cabinet : relu par EODA", () => {
  it("accompagné : crée une relecture, une seule fois par état", () => {
    expect(decideEodaReview("ACCOMPAGNE", null, LIVE_FP)).toEqual({ kind: "CREATE" });
    expect(decideEodaReview("ACCOMPAGNE", validation({ reviewedByEodaAt: REVIEWED }), LIVE_FP)).toEqual({ kind: "NOOP" });
    expect(decideEodaReview("ACCOMPAGNE", validation({ reviewedByEodaAt: REVIEWED }), CHANGED_FP)).toEqual({ kind: "CREATE" });
  });

  it("autonomie : aucune relecture EODA", () => {
    expect(decideEodaReview("AUTONOMIE", null, LIVE_FP)).toEqual({ kind: "REFUSE", message: AUTONOMY_NO_REVIEW_MESSAGE });
  });
});

describe("geste de la structure : accepté", () => {
  it("accompagné : refusé tant qu'EODA n'a pas relu", () => {
    expect(decideClientAcceptance("ACCOMPAGNE", null, LIVE_FP)).toEqual({ kind: "REFUSE", message: NOT_REVIEWED_YET_MESSAGE });
  });

  it("accompagné : refusé si le diagnostic a changé depuis la relecture", () => {
    expect(decideClientAcceptance("ACCOMPAGNE", validation({ reviewedByEodaAt: REVIEWED }), CHANGED_FP)).toEqual({
      kind: "REFUSE",
      message: CHANGED_SINCE_REVIEW_MESSAGE,
    });
  });

  it("accompagné : accepte la relecture à jour, sans redater une acceptation", () => {
    expect(decideClientAcceptance("ACCOMPAGNE", validation({ reviewedByEodaAt: REVIEWED }), LIVE_FP)).toEqual({
      kind: "UPDATE",
      validationId: "v1",
    });
    expect(
      decideClientAcceptance("ACCOMPAGNE", validation({ reviewedByEodaAt: REVIEWED, acceptedByClientAt: ACCEPTED }), LIVE_FP)
    ).toEqual({ kind: "NOOP" });
  });

  it("autonomie : accepte seule, sans relecture, et reprend une photo si l'état a changé", () => {
    expect(decideClientAcceptance("AUTONOMIE", null, LIVE_FP)).toEqual({ kind: "CREATE" });
    expect(decideClientAcceptance("AUTONOMIE", validation({ acceptedByClientAt: ACCEPTED }), LIVE_FP)).toEqual({ kind: "NOOP" });
    expect(decideClientAcceptance("AUTONOMIE", validation({ acceptedByClientAt: ACCEPTED }), CHANGED_FP)).toEqual({ kind: "CREATE" });
    expect(decideClientAcceptance("AUTONOMIE", validation({ reviewedByEodaAt: REVIEWED }), LIVE_FP)).toEqual({
      kind: "UPDATE",
      validationId: "v1",
    });
  });
});

describe("describeDiagnosticValidation", () => {
  it("autonomie : la réserve complète, jamais « relu » ni « validé »", () => {
    const view = describeDiagnosticValidation("AUTONOMIE", null, LIVE_FP);
    expect(view.mention).toBe(AUTONOMY_RESERVE);
    expect(view.clientCanAccept).toBe(true);
    expect(view.cabinetCanReview).toBe(false);
    const accepted = describeDiagnosticValidation("AUTONOMIE", validation({ acceptedByClientAt: ACCEPTED }), LIVE_FP);
    expect(accepted.acceptedLabel).toBe("Accepté par vous le 06/10 · non revérifié par un humain");
    expect(accepted.clientCanAccept).toBe(false);
    expect(JSON.stringify(accepted)).not.toMatch(/validé|Sandrine|conforme/i);
  });

  it("accompagné, non relu : le cabinet peut relire, la structure attend", () => {
    const view = describeDiagnosticValidation("ACCOMPAGNE", null, LIVE_FP);
    expect(view.mention).toBe("Pas encore relu par EODA");
    expect(view.cabinetCanReview).toBe(true);
    expect(view.clientCanAccept).toBe(false);
    expect(view.changedSinceLastGesture).toBe(false);
  });

  it("accompagné, relu : « Relu par EODA, le JJ/MM », la structure peut accepter", () => {
    const view = describeDiagnosticValidation("ACCOMPAGNE", validation({ reviewedByEodaAt: REVIEWED }), LIVE_FP);
    expect(view.mention).toBe("Relu par EODA, le 05/10");
    expect(view.clientCanAccept).toBe(true);
    expect(view.cabinetCanReview).toBe(false);
    const accepted = describeDiagnosticValidation(
      "ACCOMPAGNE",
      validation({ reviewedByEodaAt: REVIEWED, acceptedByClientAt: ACCEPTED }),
      LIVE_FP
    );
    expect(accepted.acceptedLabel).toBe("Accepté par vous le 06/10");
  });

  it("une relecture périmée n'est plus annoncée", () => {
    const view = describeDiagnosticValidation("ACCOMPAGNE", validation({ reviewedByEodaAt: REVIEWED }), CHANGED_FP);
    expect(view.mention).toBe("Pas encore relu par EODA");
    expect(view.changedSinceLastGesture).toBe(true);
    expect(view.cabinetCanReview).toBe(true);
  });
});
