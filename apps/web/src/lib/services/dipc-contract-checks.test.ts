import { describe, expect, it } from "vitest";
import {
  contractCheckGroups,
  effectiveContractChecks,
  isAccompanied,
  toggleContractCheck,
  visibleContractChecks,
} from "./dipc-contract-checks";
import { prepareDipcForTablet } from "./dipc-tablet-preparation";

// DIPEC FICTIF de même forme que celui d'EODA : trois modes de paiement, une case
// « Non accompagné(e) » sous la question « accompagné de », une case libre.
const prepared = prepareDipcForTablet(
  [
    "Le client devra régler la facture par :",
    "*   **Prélèvement automatique**",
    "*   **Chèque bancaire**",
    "*   **Virement bancaire**",
    "Les tarifs des prestations sont susceptibles d’évoluer annuellement.",
    "Le bénéficiaire était accompagné de (nom, qualité) :",
    "☐ Non accompagné(e)",
    "☐ Accord pour l’utilisation du cahier de liaison",
  ].join("\n\n")
);
const fields = prepared.checkFields;
const companionText = prepared.freeFields.find((f) => f.label.startsWith("Le bénéficiaire était accompagné de"))!.id;
const notAccompanied = fields.find((f) => f.label === "Non accompagné(e)")!.id;

describe("mode de paiement : un seul choix", () => {
  it("cocher un mode décoche les autres", () => {
    const one = toggleContractCheck({}, fields, "paiement.1", true);
    const two = toggleContractCheck(one, fields, "paiement.3", true);
    expect(two).toMatchObject({ "paiement.1": false, "paiement.2": false, "paiement.3": true });
  });

  it("décocher le mode choisi n'en coche aucun autre", () => {
    const off = toggleContractCheck({ "paiement.2": true }, fields, "paiement.2", false);
    expect(Object.entries(off).filter(([, on]) => on)).toEqual([]);
  });

  it("une case hors paiement ne touche pas au mode choisi", () => {
    const next = toggleContractCheck({ "paiement.2": true }, fields, fields.at(-1)!.id, true);
    expect(next["paiement.2"]).toBe(true);
  });

  it("le contrat ne reçoit jamais deux modes, même d'un état ancien", () => {
    const sent = effectiveContractChecks({ "paiement.1": true, "paiement.3": true }, fields, false);
    expect(sent).toMatchObject({ "paiement.1": true, "paiement.3": false });
  });
});

describe("« Non accompagné(e) » contre un accompagnant connu", () => {
  it("accompagnée si quelqu'un est noté dans « accompagné de »", () => {
    expect(isAccompanied(prepared.freeFields, { [companionText]: "Mme Martin, fille" }, ["PERSONNE", "SERVICE"])).toBe(true);
    expect(isAccompanied(prepared.freeFields, { [companionText]: "   " }, ["PERSONNE", "SERVICE"])).toBe(false);
  });

  it("accompagnée si un représentant ou une personne de confiance signe", () => {
    expect(isAccompanied(prepared.freeFields, {}, ["REPRESENTANT", "SERVICE"])).toBe(true);
    expect(isAccompanied(prepared.freeFields, {}, ["PERSONNE", "CONFIANCE", "SERVICE"])).toBe(true);
  });

  it("la case disparaît et n'est jamais cochée dans le contrat", () => {
    expect(visibleContractChecks(fields, true).map((f) => f.id)).not.toContain(notAccompanied);
    expect(visibleContractChecks(fields, false).map((f) => f.id)).toContain(notAccompanied);
    expect(effectiveContractChecks({ [notAccompanied]: true }, fields, true)[notAccompanied]).toBe(false);
    expect(effectiveContractChecks({ [notAccompanied]: true }, fields, false)[notAccompanied]).toBe(true);
  });
});

describe("explication des cases", () => {
  it("range les cases par groupe, chacun avec son indication", () => {
    const groups = contractCheckGroups(fields);
    expect(groups.map((g) => [g.kind, g.fields.length])).toEqual([["PAYMENT", 3], ["COMPANION", 1], ["OTHER", 1]]);
    expect(groups[0]!.hint).toMatch(/Un seul mode/);
    expect(groups[2]!.hint).toMatch(/une, plusieurs ou toutes/);
  });

  it("n'affiche pas un groupe vide", () => {
    expect(contractCheckGroups(fields.filter((f) => f.id.startsWith("paiement."))).map((g) => g.kind)).toEqual(["PAYMENT"]);
  });
});
