import { describe, expect, it } from "vitest";
import {
  countDevisByTab,
  describeDevisDates,
  devisRowActions,
  parseDevisTab,
  statusesForTab,
} from "./devis-list-service";

const NOW = new Date(2026, 9, 10, 9, 0);

describe("onglets de la liste des devis", () => {
  it("« En cours » regroupe brouillons et envoyés ; l'annulé n'est que dans « Tous »", () => {
    expect(statusesForTab("en-cours")).toEqual(["BROUILLON", "ENVOYE"]);
    expect(statusesForTab("signes")).toEqual(["SIGNE"]);
    expect(statusesForTab("refuses")).toEqual(["REFUSE"]);
    expect(statusesForTab("tous")).toBeNull();
  });

  it("une valeur d'URL inconnue retombe sur « En cours »", () => {
    expect(parseDevisTab(undefined)).toBe("en-cours");
    expect(parseDevisTab("signes")).toBe("signes");
    expect(parseDevisTab("ANNULE")).toBe("en-cours");
  });

  it("compte chaque onglet depuis les comptes par statut", () => {
    expect(countDevisByTab({ BROUILLON: 2, ENVOYE: 3, SIGNE: 4, REFUSE: 1, ANNULE: 5 })).toEqual({
      "en-cours": 5,
      signes: 4,
      refuses: 1,
      tous: 15,
    });
    expect(countDevisByTab({})).toEqual({ "en-cours": 0, signes: 0, refuses: 0, tous: 0 });
  });
});

describe("devisRowActions — pas de « Marquer signé »", () => {
  it("envoi : un brouillon, et seulement avec une adresse", () => {
    expect(devisRowActions("BROUILLON", "contact@example.org").canSend).toBe(true);
    expect(devisRowActions("ENVOYE", "contact@example.org").canSend).toBe(false);
    expect(devisRowActions("BROUILLON", null).canSend).toBe(false);
    expect(devisRowActions("SIGNE", "contact@example.org").canSend).toBe(false);
  });

  it("relance : un devis envoyé, avec une adresse — jamais un brouillon ni un devis signé", () => {
    expect(devisRowActions("ENVOYE", "contact@example.org").canRemind).toBe(true);
    expect(devisRowActions("ENVOYE", null).canRemind).toBe(false);
    for (const status of ["BROUILLON", "SIGNE", "REFUSE", "ANNULE"] as const) {
      expect(devisRowActions(status, "contact@example.org").canRemind).toBe(false);
    }
  });

  it("signature : un lien vers le parcours de conversion, ouvert sur un devis envoyé seulement", () => {
    expect(devisRowActions("ENVOYE", null).canSign).toBe(true);
    for (const status of ["BROUILLON", "SIGNE", "REFUSE", "ANNULE"] as const) {
      expect(devisRowActions(status, null).canSign).toBe(false);
    }
  });
});

describe("describeDevisDates", () => {
  const createdAt = new Date(2026, 9, 1);

  it("devis en attente : date de validité", () => {
    expect(describeDevisDates({ status: "ENVOYE", createdAt, validUntil: new Date(2026, 9, 31), now: NOW })).toBe(
      "Créé le 01/10/2026 · valable jusqu'au 31/10/2026"
    );
  });

  it("devis en attente expiré : il le dit", () => {
    expect(describeDevisDates({ status: "BROUILLON", createdAt, validUntil: new Date(2026, 9, 5), now: NOW })).toBe(
      "Créé le 01/10/2026 · expiré le 05/10/2026"
    );
  });

  it("devis signé : plus d'échéance utile", () => {
    expect(describeDevisDates({ status: "SIGNE", createdAt, validUntil: new Date(2026, 9, 5), now: NOW })).toBe(
      "Créé le 01/10/2026"
    );
  });
});

describe("describeDevisDates — dernier envoi", () => {
  it("un devis envoyé dit la date de son dernier envoi, dérivée du journal", () => {
    expect(
      describeDevisDates({
        status: "ENVOYE",
        createdAt: new Date(2026, 9, 1),
        validUntil: new Date(2026, 9, 31),
        now: NOW,
        lastSentAt: new Date(2026, 9, 3),
      })
    ).toBe("Envoyé le 03/10/2026 · valable jusqu'au 31/10/2026");
  });
});
