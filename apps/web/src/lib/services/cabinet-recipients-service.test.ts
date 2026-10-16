import { describe, expect, it } from "vitest";
import { selectStructureRecipients, type CabinetRecipientCandidate } from "./cabinet-recipients-service";

// Qui, au cabinet, est prévenu qu'une structure a bougé (16/10/2026).
//
// Ce qui est protégé ici : ce n'est pas une liste de rôles écrite pour l'occasion,
// c'est le PÉRIMÈTRE en vigueur partout ailleurs (resolveStructureScope). La règle
// qui compte le plus tient en une ligne de ce fichier — une COMMERCIALE ne reçoit rien,
// parce qu'elle ne voit pas les documents d'une structure. Sans ce test, une alerte
// générique finirait par lui annoncer l'activité documentaire d'un client.

const ETAB = "etab-1";
const AUTRE = "etab-2";

function candidate(overrides: Partial<CabinetRecipientCandidate>): CabinetRecipientCandidate {
  return {
    name: "Sandrine",
    email: "sandrine@eoda.test",
    role: "CABINET_ADMIN",
    isActive: true,
    assignedEstablishmentIds: [],
    ...overrides,
  };
}

describe("selectStructureRecipients — qui suit la structure", () => {
  it("prévient l'administrateur du cabinet", () => {
    const recipients = selectStructureRecipients([candidate({})], ETAB);
    expect(recipients).toEqual([{ name: "Sandrine", email: "sandrine@eoda.test" }]);
  });

  it("prévient la consultante AFFECTÉE à cette structure", () => {
    const recipients = selectStructureRecipients(
      [candidate({ name: "Consultante", email: "c@eoda.test", role: "CABINET_EVALUATOR", assignedEstablishmentIds: [ETAB] })],
      ETAB
    );
    expect(recipients).toHaveLength(1);
  });

  it("ne prévient PAS la consultante affectée à une AUTRE structure", () => {
    const recipients = selectStructureRecipients(
      [candidate({ role: "CABINET_EVALUATOR", assignedEstablishmentIds: [AUTRE] })],
      ETAB
    );
    expect(recipients).toEqual([]);
  });

  it("prévient une consultante SANS affectation — elle voit tout le portefeuille", () => {
    // Choix de compatibilité des comptes existants (`resolveStructureScope`, N9) : une
    // consultante sans affectation n'est pas cloisonnée. C'est le périmètre réel, et
    // l'alerte le suit — la « corriger » ici ferait diverger deux règles jumelles.
    const recipients = selectStructureRecipients(
      [candidate({ role: "CABINET_EVALUATOR", assignedEstablishmentIds: [] })],
      ETAB
    );
    expect(recipients).toHaveLength(1);
  });

  it("prévient le rôle de lecture seule, qui lit les structures", () => {
    const recipients = selectStructureRecipients(
      [candidate({ name: "Relecture", role: "CABINET_READONLY" })],
      ETAB
    );
    expect(recipients).toHaveLength(1);
  });
});

describe("selectStructureRecipients — qui ne reçoit rien", () => {
  it("la personne du COMMERCIAL ne reçoit jamais l'activité documentaire d'une structure", () => {
    // « Prospects et devis. Ne voit pas les documents des structures. » Un e-mail qui
    // nomme un document et une structure lui apprendrait ce qu'elle n'a pas à lire.
    expect(selectStructureRecipients([candidate({ role: "CABINET_COMMERCIAL" })], ETAB)).toEqual([]);
  });

  it("aucun rôle non-cabinet n'est prévenu (prospect inscrit seul, compte client)", () => {
    expect(selectStructureRecipients([candidate({ role: "PROSPECT_USER" })], ETAB)).toEqual([]);
    expect(selectStructureRecipients([candidate({ role: "CLIENT_USER" })], ETAB)).toEqual([]);
  });

  it("un compte DÉSACTIVÉ ne reçoit rien", () => {
    expect(selectStructureRecipients([candidate({ isActive: false })], ETAB)).toEqual([]);
  });
});

describe("selectStructureRecipients — une adresse, un message", () => {
  it("déduplique la même adresse portée par deux comptes", () => {
    const recipients = selectStructureRecipients(
      [
        candidate({ name: "Ancien compte", email: "sandrine@eoda.test" }),
        candidate({ name: "Nouveau compte", email: "sandrine@eoda.test", role: "CABINET_READONLY" }),
      ],
      ETAB
    );
    expect(recipients).toEqual([{ name: "Ancien compte", email: "sandrine@eoda.test" }]);
  });

  it("ignore une adresse vide plutôt que de tenter l'envoi", () => {
    expect(selectStructureRecipients([candidate({ email: "   " })], ETAB)).toEqual([]);
  });
});
