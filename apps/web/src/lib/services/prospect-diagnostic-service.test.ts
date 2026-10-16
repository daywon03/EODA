import { describe, expect, it } from "vitest";
import {
  buildWorkList,
  deriveDiagnosticProgress,
  deriveProspectSignal,
  momentLabelFor,
  validateCallRequest,
} from "./prospect-diagnostic-service";

const NOW = new Date(2026, 9, 13, 10, 0);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("avancement du diagnostic déclaratif", () => {
  it("pas commencé, en cours, terminé", () => {
    expect(deriveDiagnosticProgress(0, 16)).toMatchObject({ stage: "NOT_STARTED", label: "Pas commencé", percent: 0 });
    expect(deriveDiagnosticProgress(11, 16)).toMatchObject({ stage: "IN_PROGRESS", label: "En cours · 69 %", percent: 69 });
    expect(deriveDiagnosticProgress(16, 16)).toMatchObject({ stage: "DONE", label: "Terminé", percent: 100 });
  });

  it("borne les valeurs aberrantes ; aucun impératif = pas commencé", () => {
    expect(deriveDiagnosticProgress(20, 16).answered).toBe(16);
    expect(deriveDiagnosticProgress(0, 0).stage).toBe("NOT_STARTED");
  });
});

describe("liste de travail estimée", () => {
  const livret = { id: "d1", label: "Livret d'accueil" };
  const plaintes = { id: "d2", label: "Registre des plaintes" };

  it("les critères sans « Oui » appellent leurs documents, dédupliqués et triés", () => {
    const items = buildWorkList([
      { criterionId: "c1", criterionCode: "3.12.1", answer: "PAS_ENCORE", expectedDocuments: [plaintes, livret] },
      { criterionId: "c2", criterionCode: "2.2.6", answer: "EN_PARTIE", expectedDocuments: [livret] },
      { criterionId: "c3", criterionCode: "2.2.2", answer: "OUI", expectedDocuments: [{ id: "d3", label: "Procédure" }] },
      { criterionId: "c4", criterionCode: "2.2.7", answer: null, expectedDocuments: [{ id: "d4", label: "Sans réponse" }] },
    ]);
    expect(items).toEqual([
      { documentTypeId: "d1", label: "Livret d'accueil", criterionCodes: ["3.12.1", "2.2.6"] },
      { documentTypeId: "d2", label: "Registre des plaintes", criterionCodes: ["3.12.1"] },
    ]);
  });
});

describe("signal d'activité vu par le cabinet", () => {
  const progress = deriveDiagnosticProgress(5, 16);

  it("un appel demandé passe avant tout", () => {
    const signal = deriveProspectSignal({
      now: NOW,
      signedUpAt: daysAgo(30),
      lastActivityAt: daysAgo(20),
      pendingCall: { day: new Date(2026, 9, 16, 9), momentLabel: "le matin" },
      progress,
    });
    expect(signal.kind).toBe("CALL");
    expect(signal.text).toMatch(/^Appel demandé · .*le matin$/);
  });

  it.each([
    [null, 2, "Inscrite il y a 2 jours", false],
    [null, 0, "Inscrite aujourd'hui", false],
    [null, 12, "Aucune activité depuis 12 jours", true],
    [0, 30, "Active aujourd'hui", false],
    [1, 30, "Active hier", false],
    [4, 30, "Active il y a 4 jours", false],
    [12, 30, "Aucune activité depuis 12 jours", true],
  ])("dernière activité il y a %s j, inscrite il y a %s j → %s", (activity, signup, text, inactive) => {
    const signal = deriveProspectSignal({
      now: NOW,
      signedUpAt: daysAgo(signup),
      lastActivityAt: activity === null ? null : daysAgo(activity),
      pendingCall: null,
      progress,
    });
    expect(signal.text).toBe(text);
    expect(signal.inactive).toBe(inactive);
    expect(signal.kind).toBe("IN_PROGRESS");
  });

  it("un diagnostic terminé n'est jamais « à relancer »", () => {
    const signal = deriveProspectSignal({
      now: NOW,
      signedUpAt: daysAgo(40),
      lastActivityAt: daysAgo(15),
      pendingCall: null,
      progress: deriveDiagnosticProgress(16, 16),
    });
    expect(signal).toMatchObject({ kind: "DONE", inactive: false });
  });
});

describe("demande « Être accompagné » — préférence libre", () => {
  it("un jour entre demain et 60 jours, le matin ou l'après-midi, 20 minutes", () => {
    const result = validateCallRequest({ day: "2026-10-16", moment: "APRES_MIDI", message: "  Le plan de continuité.  " }, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.startsAt).toEqual(new Date(2026, 9, 16, 14, 0));
      expect(result.value.endsAt).toEqual(new Date(2026, 9, 16, 14, 20));
      expect(result.value.message).toBe("Le plan de continuité.");
      expect(momentLabelFor(result.value.startsAt)).toBe("l'après-midi");
    }
  });

  it.each([
    [{ day: "", moment: "MATIN" }, "Choisissez un jour"],
    [{ day: "16/10/2026", moment: "MATIN" }, "Choisissez un jour"],
    [{ day: "2026-02-31", moment: "MATIN" }, "n'existe pas"],
    [{ day: "2026-10-13", moment: "MATIN" }, "entre demain"],
    [{ day: "2027-01-30", moment: "MATIN" }, "entre demain"],
    [{ day: "2026-10-16", moment: "SOIR" }, "matin ou l'après-midi"],
    [{ day: "2026-10-16", moment: "MATIN", message: "x".repeat(501) }, "trop long"],
  ])("refuse %o", (input, message) => {
    const result = validateCallRequest({ message: null, ...input }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("libellé du moment", () => {
    expect(momentLabelFor(new Date(2026, 9, 16, 9))).toBe("le matin");
  });
});
