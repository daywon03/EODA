import { describe, expect, it } from "vitest";
import type { DevisStatus } from "@eoda/database";
import {
  DEVIS_ALLOWED_TRANSITIONS,
  canTransitionDevis,
  isDevisCountedInKpi,
  isDevisDeletable,
  isDevisEditable,
} from "./devis-transition-service";

// Cette table est le contrôle mécanique du cycle de vie d'un devis : elle est
// appliquée côté serveur par `changeDevisStatus` ET consommée par l'UI. Un test
// par règle métier, y compris les REFUS — ce sont eux qui protègent la série
// numérotée et les indicateurs.

const ALL_STATUSES: DevisStatus[] = ["BROUILLON", "ENVOYE", "SIGNE", "REFUSE", "ANNULE"];

describe("transitions de statut d'un devis", () => {
  it("laisse un brouillon partir en envoyé ou en refusé", () => {
    expect(canTransitionDevis("BROUILLON", "ENVOYE")).toBe(true);
    expect(canTransitionDevis("BROUILLON", "REFUSE")).toBe(true);
  });

  it("interdit d'annuler un brouillon — un brouillon se supprime", () => {
    expect(canTransitionDevis("BROUILLON", "ANNULE")).toBe(false);
  });

  it("permet d'annuler un devis envoyé ou signé, pour conserver son numéro", () => {
    expect(canTransitionDevis("ENVOYE", "ANNULE")).toBe(true);
    expect(canTransitionDevis("SIGNE", "ANNULE")).toBe(true);
  });

  it("refuse toute rétrogradation d'un devis signé", () => {
    expect(canTransitionDevis("SIGNE", "BROUILLON")).toBe(false);
    expect(canTransitionDevis("SIGNE", "ENVOYE")).toBe(false);
    expect(canTransitionDevis("SIGNE", "REFUSE")).toBe(false);
  });

  it("refuse de faire revivre un devis refusé ou annulé", () => {
    for (const target of ALL_STATUSES) {
      expect(canTransitionDevis("REFUSE", target)).toBe(false);
      expect(canTransitionDevis("ANNULE", target)).toBe(false);
    }
  });

  it("n'autorise jamais une transition d'un statut vers lui-même", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransitionDevis(status, status)).toBe(false);
    }
  });

  it("couvre exactement les cinq statuts du schéma", () => {
    expect(Object.keys(DEVIS_ALLOWED_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort());
  });
});

describe("modification et suppression", () => {
  it("ne rend modifiable et supprimable que le brouillon", () => {
    for (const status of ALL_STATUSES) {
      const draft = status === "BROUILLON";
      expect(isDevisEditable(status)).toBe(draft);
      expect(isDevisDeletable(status)).toBe(draft);
    }
  });
});

describe("prise en compte dans les indicateurs", () => {
  it("exclut le seul statut ANNULE", () => {
    for (const status of ALL_STATUSES) {
      expect(isDevisCountedInKpi(status)).toBe(status !== "ANNULE");
    }
  });
});
