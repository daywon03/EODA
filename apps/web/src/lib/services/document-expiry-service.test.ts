import { describe, expect, it } from "vitest";
import {
  applyExpiry,
  describeExpiry,
  isExpired,
  monthsBetween,
  type ExpiryFacts,
} from "./document-expiry-service";

const NOW = new Date(2026, 8, 3); // 3 septembre 2026

function facts(overrides: Partial<ExpiryFacts> = {}): ExpiryFacts {
  return { expectedFrequency: "ANNUAL", currentVersionAt: new Date(2025, 8, 3), ...overrides };
}

describe("monthsBetween", () => {
  it("compte en mois de calendrier", () => {
    expect(monthsBetween(new Date(2025, 8, 3), NOW)).toBe(12);
  });

  it("ne compte pas un mois entamé", () => {
    // Un décompte en tranches de 30 jours ferait périmer un document la veille de sa
    // date anniversaire.
    expect(monthsBetween(new Date(2025, 8, 4), NOW)).toBe(11);
  });
});

describe("isExpired", () => {
  it("périme un document annuel au jour anniversaire", () => {
    expect(isExpired(facts(), NOW)).toBe(true);
  });

  it("ne périme pas la veille", () => {
    expect(isExpired(facts({ currentVersionAt: new Date(2025, 8, 4) }), NOW)).toBe(false);
  });

  it("laisse deux ans à un document biennal", () => {
    expect(isExpired(facts({ expectedFrequency: "BIANNUAL" }), NOW)).toBe(false);
    expect(
      isExpired(facts({ expectedFrequency: "BIANNUAL", currentVersionAt: new Date(2024, 8, 3) }), NOW)
    ).toBe(true);
  });

  it("ne périme jamais un document produit à la demande", () => {
    expect(
      isExpired(facts({ expectedFrequency: "ON_DEMAND", currentVersionAt: new Date(2015, 0, 1) }), NOW)
    ).toBe(false);
  });

  it("ne périme rien quand aucune version n'existe", () => {
    // Un document absent est MANQUANT, pas périmé.
    expect(isExpired(facts({ currentVersionAt: null }), NOW)).toBe(false);
  });

  it("ne périme rien sans fréquence attendue", () => {
    expect(isExpired(facts({ expectedFrequency: null }), NOW)).toBe(false);
  });
});

describe("applyExpiry", () => {
  it("remplace « conforme » par « périmé » quand la version a vieilli", () => {
    // Une checklist qui annonce « conforme » sur un compte rendu de 2023 ment.
    expect(applyExpiry("COMPLIANT", facts(), NOW)).toBe("EXPIRED");
  });

  it("laisse « manquant » intact", () => {
    expect(applyExpiry("MISSING", facts(), NOW)).toBe("MISSING");
  });

  it("laisse « non applicable » et « en analyse » intacts", () => {
    // Un document hors périmètre reste hors périmètre ; un document en cours
    // d'analyse n'est pas encore jugeable.
    expect(applyExpiry("NOT_APPLICABLE", facts(), NOW)).toBe("NOT_APPLICABLE");
    expect(applyExpiry("ANALYZING", facts(), NOW)).toBe("ANALYZING");
  });

  it("laisse le statut tel quel quand rien n'est périmé", () => {
    expect(applyExpiry("COMPLIANT", facts({ currentVersionAt: new Date(2026, 5, 1) }), NOW)).toBe(
      "COMPLIANT"
    );
  });
});

describe("describeExpiry", () => {
  it("dit l'âge de la version, pas seulement qu'elle est périmée", () => {
    // Sans ça, le client répond « mais je vous l'ai envoyé ».
    expect(describeExpiry(facts({ currentVersionAt: new Date(2024, 2, 3) }), NOW)).toContain("2 ans");
  });

  it("ne dit rien sur un document à jour", () => {
    expect(describeExpiry(facts({ currentVersionAt: new Date(2026, 5, 1) }), NOW)).toBeNull();
  });
});
