import { describe, expect, it } from "vitest";
import {
  CVS_CODE,
  CVS_NOT_CONCERNED_NEEDS_FORM,
  PARTICIPATION_LINE_CODE,
  cvsNotConcernedError,
  describeParticipationForm,
  parseParticipationForm,
  participationLineLabel,
} from "./participation-form-service";

// Forme de participation des usagers (21/10/2026) : CVS et autre forme, deux livrables.
describe("parseParticipationForm — entrée hostile", () => {
  it("lit les trois formes, efface la précision hors « Autre »", () => {
    expect(parseParticipationForm("ENQUETE_SATISFACTION", "ignoré")).toEqual({ ok: true, form: "ENQUETE_SATISFACTION", otherLabel: null });
    expect(parseParticipationForm("GROUPE_PAROLE", null)).toEqual({ ok: true, form: "GROUPE_PAROLE", otherLabel: null });
    expect(parseParticipationForm("AUTRE", "  Réunions trimestrielles ")).toEqual({ ok: true, form: "AUTRE", otherLabel: "Réunions trimestrielles" });
  });

  it("refuse une forme inconnue, un « Autre » sans précision ou trop long", () => {
    expect(parseParticipationForm("CVS", null).ok).toBe(false);
    expect(parseParticipationForm("AUTRE", "   ").ok).toBe(false);
    expect(parseParticipationForm("AUTRE", "x".repeat(81)).ok).toBe(false);
  });
});

describe("libellé affiché de la ligne", () => {
  it("ajoute la forme choisie, sur la seule ligne « Autre forme de participation »", () => {
    const base = "Autre forme de participation des usagers";
    expect(participationLineLabel(PARTICIPATION_LINE_CODE, base, "ENQUETE_SATISFACTION", null)).toBe(
      "Autre forme de participation des usagers — Enquête de satisfaction"
    );
    expect(participationLineLabel(PARTICIPATION_LINE_CODE, base, "AUTRE", "Boîte à idées")).toBe(`${base} — Boîte à idées`);
    expect(participationLineLabel(PARTICIPATION_LINE_CODE, base, null, null)).toBe(base);
    // Jamais sur le CVS : ce n'est pas une équivalence.
    expect(participationLineLabel(CVS_CODE, "Comptes-rendus CVS", "ENQUETE_SATISFACTION", null)).toBe("Comptes-rendus CVS");
    expect(describeParticipationForm(null, null)).toBeNull();
  });
});

describe("CVS « Non concerné » — seulement une fois l'autre forme choisie", () => {
  it("refusé sans forme, accepté avec, sans effet sur les autres documents", () => {
    expect(cvsNotConcernedError(CVS_CODE, null)).toBe(CVS_NOT_CONCERNED_NEEDS_FORM);
    expect(cvsNotConcernedError(CVS_CODE, "ENQUETE_SATISFACTION")).toBeNull();
    expect(cvsNotConcernedError("RH_X", null)).toBeNull();
  });
});
