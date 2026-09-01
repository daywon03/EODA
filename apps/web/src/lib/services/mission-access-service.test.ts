import { describe, expect, it } from "vitest";
import {
  canClientRead,
  canDepositDocuments,
  deriveMissionAccessState,
  isLibraryUpdateAlertDue,
  monthsElapsed,
} from "./mission-access-service";

const CLOSED_ON = new Date("2026-09-01T10:00:00Z");

describe("deriveMissionAccessState", () => {
  it("laisse ouvert tant que rien n'est clos", () => {
    expect(deriveMissionAccessState({ closedAt: null, clientAccessRevokedAt: null })).toBe("ACTIVE");
  });

  it("bascule en bibliothèque à la clôture — la clôture ne coupe rien", () => {
    // Position finale du call : on ne coupe pas l'accès à la fin de l'accompagnement.
    expect(deriveMissionAccessState({ closedAt: CLOSED_ON, clientAccessRevokedAt: null })).toBe(
      "LIBRARY"
    );
  });

  it("coupe l'accès quand la révocation est posée", () => {
    expect(
      deriveMissionAccessState({ closedAt: CLOSED_ON, clientAccessRevokedAt: CLOSED_ON })
    ).toBe("REVOKED");
  });

  it("laisse la révocation trancher même sur une mission encore ouverte", () => {
    // Rupture ou impayé : la coupure doit s'appliquer sans attendre une clôture.
    expect(deriveMissionAccessState({ closedAt: null, clientAccessRevokedAt: CLOSED_ON })).toBe(
      "REVOKED"
    );
  });

  it("ne ferme rien en l'absence de mission", () => {
    // Avant-vente, ou fiche antérieure à l'entonnoir unique : refuser ici couperait
    // l'accès d'un client dont l'accompagnement n'a pas commencé.
    expect(deriveMissionAccessState(null)).toBe("ACTIVE");
  });
});

describe("canDepositDocuments", () => {
  it("n'autorise le dépôt que sur une mission active", () => {
    expect(canDepositDocuments("ACTIVE")).toBe(true);
    expect(canDepositDocuments("LIBRARY")).toBe(false);
    expect(canDepositDocuments("REVOKED")).toBe(false);
  });
});

describe("canClientRead", () => {
  it("garde la lecture ouverte en bibliothèque, la ferme après révocation", () => {
    expect(canClientRead("LIBRARY")).toBe(true);
    expect(canClientRead("REVOKED")).toBe(false);
  });
});

describe("monthsElapsed", () => {
  it("compte en mois de calendrier, pas en tranches de 30 jours", () => {
    expect(monthsElapsed(new Date("2026-01-31"), new Date("2026-03-31"))).toBe(2);
  });

  it("ne compte pas un mois entamé", () => {
    expect(monthsElapsed(new Date("2026-01-15"), new Date("2026-02-14"))).toBe(0);
  });

  it("compte le mois dès le jour anniversaire atteint", () => {
    expect(monthsElapsed(new Date("2026-01-15"), new Date("2026-02-15"))).toBe(1);
  });
});

describe("isLibraryUpdateAlertDue", () => {
  const library = { closedAt: new Date("2026-09-01"), clientAccessRevokedAt: null };

  it("ne s'annonce pas avant le 5ᵉ mois", () => {
    expect(isLibraryUpdateAlertDue(library, new Date("2027-01-15"))).toBe(false);
  });

  it("s'annonce au 5ᵉ mois révolu", () => {
    expect(isLibraryUpdateAlertDue(library, new Date("2027-02-01"))).toBe(true);
  });

  it("ne s'annonce jamais sur une mission encore active", () => {
    // Rien ne date tant que l'accompagnement produit encore des documents.
    expect(
      isLibraryUpdateAlertDue({ closedAt: null, clientAccessRevokedAt: null }, new Date("2027-06-01"))
    ).toBe(false);
  });

  it("ne s'annonce pas à un client dont l'accès est révoqué", () => {
    expect(
      isLibraryUpdateAlertDue(
        { closedAt: new Date("2026-09-01"), clientAccessRevokedAt: new Date("2026-10-01") },
        new Date("2027-06-01")
      )
    ).toBe(false);
  });
});
