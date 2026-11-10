import { describe, expect, it } from "vitest";
import {
  CANCEL_PENDING_NOTICE,
  describeCancelledDeposit,
  describeDepositEffects,
  formatFileSize,
  planDepositCancellation,
  type CancellationFacts,
} from "./document-deposit-service";

// Retour de Sandrine (09/11/2026, 22h52) : « Il me faut la possibilité d'annuler un
// dépôt de doc en cours… Là je me suis trompée et je n'ai pas pu empêcher l'action. »
// Le dépôt se confirme avant l'envoi (récapitulatif honnête de ses effets), et
// s'annule pendant l'envoi : la version que l'appelant vient de déposer est retirée.

describe("formatFileSize", () => {
  it("écrit les petits fichiers en Ko, jamais « 0 Ko »", () => {
    expect(formatFileSize(10)).toBe("1 Ko");
    expect(formatFileSize(300 * 1024)).toBe("300 Ko");
  });

  it("écrit les gros fichiers en Mo, avec une virgule", () => {
    expect(formatFileSize(Math.round(2.5 * 1024 * 1024))).toBe("2,5 Mo");
  });
});

describe("describeDepositEffects — ce que le dépôt va faire, dit AVANT l'envoi", () => {
  it("version finale d'EODA : validé tout de suite, la structure prévenue par e-mail", () => {
    const effects = describeDepositEffects({ side: "CABINET", cabinetFinal: true, documentValidated: false });
    expect(effects).toContain("Le document sera validé tout de suite et la structure prévenue par e-mail.");
  });

  it("dépôt du cabinet sur un document non validé : « À relire », personne n'est prévenu", () => {
    const effects = describeDepositEffects({ side: "CABINET", cabinetFinal: false, documentValidated: false });
    expect(effects.join(" ")).toMatch(/À relire/);
    expect(effects.join(" ")).toMatch(/Personne n'est prévenu/);
    expect(effects.join(" ")).not.toMatch(/validé tout de suite/);
  });

  it("dépôt du cabinet sur un document DÉJÀ validé : remis tout de suite, la structure prévenue (uploadDocument l'annonce)", () => {
    const effects = describeDepositEffects({ side: "CABINET", cabinetFinal: false, documentValidated: true });
    expect(effects.join(" ")).toMatch(/déjà validé/);
    expect(effects.join(" ")).toMatch(/prévenue par e-mail/);
  });

  it("dépôt de la structure : l'équipe EODA est prévenue, jamais une validation", () => {
    const effects = describeDepositEffects({ side: "CLIENT", cabinetFinal: true, documentValidated: true });
    expect(effects.join(" ")).toMatch(/équipe EODA sera prévenue par e-mail/);
    expect(effects.join(" ")).not.toMatch(/validé/);
  });

  it("dit toujours que l'analyse se lance au dépôt", () => {
    for (const side of ["CABINET", "CLIENT"] as const) {
      expect(describeDepositEffects({ side, cabinetFinal: false, documentValidated: false }).join(" ")).toMatch(/lu/);
    }
  });
});

const FACTS: CancellationFacts = {
  actorUserId: "consultante-1",
  actorIsCabinet: true,
  uploaderUserId: "consultante-1",
  versionProducedByCabinet: true,
  isLatest: true,
  validatedOnDeposit: false,
  priorValidatedAt: null,
  priorValidatedByUserId: null,
  versionUploadedAt: new Date("2026-11-10T10:00:00Z"),
  documentValidatedAt: null,
  clientAcceptedAt: null,
};

const CLIENT_FACTS: CancellationFacts = {
  ...FACTS,
  actorUserId: "client-1",
  uploaderUserId: "client-1",
  actorIsCabinet: false,
  versionProducedByCabinet: false,
};

// Relecture de sécurité du 10/11/2026 : une structure pouvait annuler un dépôt qu'EODA
// avait relu (ou qu'elle avait accepté) entre-temps — le travail de relecture disparaissait
// avec la version.
describe("planDepositCancellation — un dépôt relu ou accepté depuis ne s'annule plus (structure)", () => {
  const after = new Date("2026-11-10T10:05:00Z");
  const before = new Date("2026-11-01T10:00:00Z");

  it("validé par EODA APRÈS le dépôt : refusé", () => {
    expect(planDepositCancellation({ ...CLIENT_FACTS, documentValidatedAt: after })).toEqual({
      ok: false,
      reason: "REVIEWED_SINCE_DEPOSIT",
    });
  });

  it("accepté par la structure APRÈS le dépôt : refusé", () => {
    expect(planDepositCancellation({ ...CLIENT_FACTS, clientAcceptedAt: after })).toEqual({
      ok: false,
      reason: "REVIEWED_SINCE_DEPOSIT",
    });
  });

  it("validation ou acceptation ANTÉRIEURES au dépôt : l'annulation reste possible", () => {
    expect(planDepositCancellation({ ...CLIENT_FACTS, documentValidatedAt: before, clientAcceptedAt: before })).toEqual({
      ok: true,
      validation: { kind: "UNCHANGED" },
    });
  });

  it("le cabinet annule son propre dépôt « Version finale », qui a lui-même validé le document", () => {
    expect(planDepositCancellation({ ...FACTS, validatedOnDeposit: true, documentValidatedAt: after })).toEqual({
      ok: true,
      validation: { kind: "REMOVE" },
    });
  });
});

describe("planDepositCancellation — qui peut annuler, et ce qu'on rétablit", () => {
  it("refuse le dépôt de quelqu'un d'autre, même du même côté", () => {
    expect(planDepositCancellation({ ...FACTS, uploaderUserId: "consultante-2" })).toEqual({
      ok: false,
      reason: "NOT_OWN_DEPOSIT",
    });
  });

  it("refuse une version qui n'est plus la dernière (même règle que la suppression)", () => {
    expect(planDepositCancellation({ ...FACTS, isLatest: false })).toEqual({ ok: false, reason: "NOT_LATEST" });
  });

  it("refuse une version d'un autre côté (canDeleteVersion)", () => {
    expect(planDepositCancellation({ ...FACTS, versionProducedByCabinet: false })).toEqual({
      ok: false,
      reason: "NOT_OWN_DEPOSIT",
    });
  });

  it("dépôt qui n'a pas validé : la validation n'est pas touchée", () => {
    expect(planDepositCancellation(FACTS)).toEqual({ ok: true, validation: { kind: "UNCHANGED" } });
  });

  it("dépôt qui a validé un document qui ne l'était pas : la validation est retirée", () => {
    expect(planDepositCancellation({ ...FACTS, validatedOnDeposit: true })).toEqual({
      ok: true,
      validation: { kind: "REMOVE" },
    });
  });

  it("dépôt qui a remplacé une validation antérieure : elle est rétablie telle quelle", () => {
    const before = new Date("2026-11-01T10:00:00Z");
    expect(
      planDepositCancellation({
        ...FACTS,
        validatedOnDeposit: true,
        priorValidatedAt: before,
        priorValidatedByUserId: "consultante-2",
      })
    ).toEqual({
      ok: true,
      validation: { kind: "RESTORE", validatedAt: before, validatedByUserId: "consultante-2" },
    });
  });

  it("une structure annule son propre dépôt", () => {
    expect(
      planDepositCancellation({
        ...FACTS,
        actorUserId: "client-1",
        uploaderUserId: "client-1",
        actorIsCabinet: false,
        versionProducedByCabinet: false,
      })
    ).toEqual({ ok: true, validation: { kind: "UNCHANGED" } });
  });
});

describe("describeCancelledDeposit — le message final dit ce qui a été défait, et ce qui ne l'a pas été", () => {
  it("dit que la version a été retirée", () => {
    expect(describeCancelledDeposit({ side: "CABINET", validation: "UNCHANGED", notifiedCount: 0 })).toBe(
      "Dépôt annulé : la version a été retirée."
    );
  });

  it("cabinet : dit que la structure avait déjà été prévenue quand un e-mail est parti", () => {
    const message = describeCancelledDeposit({ side: "CABINET", validation: "REMOVED", notifiedCount: 2 });
    expect(message).toContain("Dépôt annulé : la version a été retirée.");
    expect(message).toContain("La structure avait déjà été prévenue par e-mail.");
  });

  it("structure : dit que l'équipe EODA avait déjà été prévenue", () => {
    expect(describeCancelledDeposit({ side: "CLIENT", validation: "UNCHANGED", notifiedCount: 1 })).toContain(
      "L'équipe EODA avait déjà été prévenue par e-mail."
    );
  });

  it("dit ce qu'il advient de la validation", () => {
    expect(describeCancelledDeposit({ side: "CABINET", validation: "REMOVED", notifiedCount: 0 })).toMatch(
      /validation posée par ce dépôt a été retirée/
    );
    expect(describeCancelledDeposit({ side: "CABINET", validation: "RESTORED", notifiedCount: 0 })).toMatch(
      /validation d'avant/
    );
  });

  it("l'annonce d'attente ne promet pas d'interrompre le serveur", () => {
    expect(CANCEL_PENDING_NOTICE).toMatch(/termine|finit/);
    expect(CANCEL_PENDING_NOTICE).toMatch(/retirée/);
  });
});
