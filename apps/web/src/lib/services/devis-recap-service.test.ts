import { describe, expect, it } from "vitest";
import {
  buildDevisRecap,
  canRemindDevis,
  COMMITMENT_CHOICES,
  describeCommitment,
  isDevisDueForReminder,
  lastSentAt,
  offerModeLabel,
  parseCommitmentMonths,
  summarizeDevis,
} from "./devis-recap-service";

const NBSP = " ";
const euros = (n: string) => `${n}${NBSP}€`;

describe("engagement", () => {
  it("trois choix fermés : 12 mois, 24 mois, sans engagement", () => {
    expect(COMMITMENT_CHOICES).toEqual([12, 24, 0]);
    expect(parseCommitmentMonths("12")).toBe(12);
    expect(parseCommitmentMonths("24")).toBe(24);
    expect(parseCommitmentMonths("0")).toBe(0);
  });

  it("refuse toute autre valeur, sans l'arrondir", () => {
    for (const raw of ["6", "36", "12.5", "", "  ", "abc", null, undefined, 12]) {
      expect(parseCommitmentMonths(raw)).toBeNull();
    }
  });

  it("dit l'engagement sous le récapitulatif ; rien pour un devis ancien", () => {
    expect(describeCommitment(12)).toMatch(/^Engagement de 12 mois/);
    expect(describeCommitment(24)).toMatch(/^Engagement de 24 mois/);
    expect(describeCommitment(0)).toBe("Sans engagement, résiliable chaque mois.");
    expect(describeCommitment(null)).toBeNull();
  });
});

describe("mode d'une offre (décision 2 du plan v2)", () => {
  it("Essentiel et Performance seuls, Excellence et bêta avec EODA", () => {
    expect(offerModeLabel("ESSENTIEL")).toBe("Seul");
    expect(offerModeLabel("PERFORMANCE")).toBe("Seul");
    expect(offerModeLabel("EXCELLENCE")).toBe("Avec EODA");
    expect(offerModeLabel("BETA")).toBe("Avec EODA");
  });
});

describe("récapitulatif « Par mois » / « Ponctuel »", () => {
  const visite = { label: "Visite sur site", unitPriceEuros: 900, pricingUnit: "JOUR" as const, minQuantity: null };
  const portail = { label: "Portail", unitPriceEuros: 280, pricingUnit: "MOIS" as const, minQuantity: 12 };

  it("prix mensuel non fixé : « xx € », jamais un montant inventé", () => {
    const recap = buildDevisRecap({ offer: { label: "Essentiel", forfaitEuros: 0, monthlyEuros: null }, options: [] });
    expect(recap.lines).toEqual([{ key: "offer-monthly", label: "Offre Essentiel", price: "xx € / mois" }]);
    expect(recap.monthly).toBe("xx €");
    expect(recap.once).toBe("—");
  });

  it("range l'abonnement au mois et le forfait et les prestations en ponctuel", () => {
    const recap = buildDevisRecap({
      offer: { label: "Excellence", forfaitEuros: 15000, monthlyEuros: 120 },
      options: [visite, portail],
    });
    expect(recap.lines.map((l) => l.label)).toEqual([
      "Offre Excellence",
      "Offre Excellence · forfait",
      "Visite sur site",
      "Portail",
    ]);
    expect(recap.monthly).toBe(euros("400"));
    expect(recap.once).toBe(euros("15 900"));
  });

  it("une prestation ponctuelle à minimum compte son minimum", () => {
    const heures = { label: "Mise à jour", unitPriceEuros: 95, pricingUnit: "HEURE" as const, minQuantity: 2 };
    expect(buildDevisRecap({ offer: null, options: [heures] }).once).toBe(euros("190"));
  });

  it("devis sans offre : aucune ligne d'offre", () => {
    const recap = buildDevisRecap({ offer: null, options: [visite] });
    expect(recap.lines).toHaveLength(1);
    expect(recap.monthly).toBe("—");
  });
});

describe("résumé d'une ligne de devis", () => {
  it("offre · options · engagement", () => {
    expect(summarizeDevis({ formuleLabel: "Excellence", optionLabels: ["Visite"], commitmentMonths: 12 })).toBe(
      "Excellence · Visite · 12 mois"
    );
    expect(summarizeDevis({ formuleLabel: null, optionLabels: ["Atelier"], commitmentMonths: 0 })).toBe(
      "Sans offre · Atelier · sans engagement"
    );
    expect(summarizeDevis({ formuleLabel: "Essentiel", optionLabels: [], commitmentMonths: null })).toBe("Essentiel");
  });
});

describe("relance d'un devis envoyé", () => {
  const now = new Date(2026, 9, 13, 9, 0);

  it("le dernier envoi est le plus récent des événements, sinon la création", () => {
    const createdAt = new Date(2026, 8, 1);
    expect(lastSentAt({ createdAt, sentEvents: [] })).toBe(createdAt);
    expect(lastSentAt({ createdAt, sentEvents: [new Date(2026, 8, 3), new Date(2026, 8, 9)] })).toEqual(new Date(2026, 8, 9));
  });

  it("à relancer au-delà de 7 jours, et seulement s'il est envoyé", () => {
    expect(isDevisDueForReminder({ status: "ENVOYE", lastSentAt: new Date(2026, 9, 1), now })).toBe(true);
    expect(isDevisDueForReminder({ status: "ENVOYE", lastSentAt: new Date(2026, 9, 10), now })).toBe(false);
    expect(isDevisDueForReminder({ status: "BROUILLON", lastSentAt: new Date(2026, 8, 1), now })).toBe(false);
    expect(isDevisDueForReminder({ status: "SIGNE", lastSentAt: new Date(2026, 8, 1), now })).toBe(false);
  });

  it("le geste exige un devis envoyé et une adresse", () => {
    expect(canRemindDevis("ENVOYE", "contact@example.org")).toBe(true);
    expect(canRemindDevis("ENVOYE", null)).toBe(false);
    expect(canRemindDevis("BROUILLON", "contact@example.org")).toBe(false);
  });
});
