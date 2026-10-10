import { describe, expect, it } from "vitest";
import { computeDefaultValidityDays } from "./devis-validity-service";

// Décision Q10 bis (bilan 08/10/2026) : 15 jours si l'évaluation HAS est à moins de
// 6 mois, 30 jours sinon.

const NOW = new Date(2026, 9, 10, 9, 0);

function validity(target: Date | null, fallbackDays = 30) {
  return computeDefaultValidityDays({ evaluationTargetDate: target, now: NOW, fallbackDays });
}

describe("computeDefaultValidityDays", () => {
  it("évaluation à moins de 6 mois : 15 jours", () => {
    expect(validity(new Date(2027, 0, 15)).days).toBe(15);
    expect(validity(new Date(2027, 3, 9)).days).toBe(15);
  });

  it("évaluation à 6 mois pile ou plus : 30 jours", () => {
    expect(validity(new Date(2027, 3, 10, 9, 0)).days).toBe(30);
    expect(validity(new Date(2028, 0, 1)).days).toBe(30);
  });

  it("échéance déjà dépassée : la plus courte, l'urgence est maximale", () => {
    expect(validity(new Date(2026, 5, 1)).days).toBe(15);
  });

  it("échéance inconnue : le réglage de facturation du cabinet, avec la raison", () => {
    expect(validity(null, 45)).toEqual({
      days: 45,
      reason: "Échéance HAS inconnue : durée par défaut des réglages de facturation.",
    });
  });

  it("dit pourquoi la valeur est proposée", () => {
    expect(validity(new Date(2027, 0, 15)).reason).toBe("Évaluation HAS à moins de 6 mois : 15 jours.");
    expect(validity(new Date(2028, 0, 1)).reason).toBe("Évaluation HAS à 6 mois ou plus : 30 jours.");
  });
});
