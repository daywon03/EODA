import { describe, expect, it } from "vitest";
import {
  deriveProspectNextAction,
  describeProspectRelation,
  type ProspectActionFacts,
} from "./prospect-next-action-service";

function facts(overrides: Partial<ProspectActionFacts> = {}): ProspectActionFacts {
  return {
    prospectId: "p1",
    status: "NOUVEAU",
    latestDevisId: null,
    establishmentId: null,
    ...overrides,
  };
}

describe("deriveProspectNextAction", () => {
  it("mène à l'évaluation des besoins sur un prospect neuf", () => {
    expect(deriveProspectNextAction(facts())?.href).toBe(
      "/dashboard/cabinet/commercial/prospects/p1/evaluation-besoins"
    );
  });

  it("ouvre l'édition d'un devis depuis le RDV de découverte", () => {
    // C'est la demande de Sandrine : depuis la réunion, on choisit l'offre et on
    // édite le devis dans la foulée.
    expect(deriveProspectNextAction(facts({ status: "RDV" }))?.href).toBe(
      "/dashboard/cabinet/commercial/devis/nouveau?prospectId=p1"
    );
  });

  it("reprend le devis existant plutôt que d'en ouvrir un second", () => {
    const action = deriveProspectNextAction(facts({ status: "RDV", latestDevisId: "d9" }));
    expect(action?.href).toBe("/dashboard/cabinet/commercial/devis/d9");
    expect(action?.label).toBe("Reprendre le devis");
  });

  it("renvoie vers l'historique une fois le devis envoyé", () => {
    // Plus rien à éditer tant qu'ils n'ont pas répondu : ce qui se perd à cette
    // étape, ce sont les échanges.
    expect(deriveProspectNextAction(facts({ status: "DEVIS_ENVOYE" }))?.href).toBe(
      "/dashboard/cabinet/commercial/prospects/p1#historique"
    );
  });

  it("propose un devis révisé en négociation, jamais la réécriture de l'envoyé", () => {
    expect(deriveProspectNextAction(facts({ status: "NEGOCIATION" }))?.href).toBe(
      "/dashboard/cabinet/commercial/devis/nouveau?prospectId=p1"
    );
  });

  it("mène à la signature quand le devis est signé mais la fiche pas encore créée", () => {
    const action = deriveProspectNextAction(facts({ status: "SIGNE", latestDevisId: "d9" }));
    expect(action?.href).toBe("/dashboard/cabinet/commercial/devis/d9/signature");
  });

  it("mène à la fiche client dès que la conversion a eu lieu", () => {
    const action = deriveProspectNextAction(
      facts({ status: "SIGNE", latestDevisId: "d9", establishmentId: "e1" })
    );
    expect(action?.href).toBe("/dashboard/cabinet/etablissements/e1");
  });

  it("ne propose rien sur un prospect signé sans devis ni fiche", () => {
    expect(deriveProspectNextAction(facts({ status: "SIGNE" }))).toBeNull();
  });

  it("ne propose rien sur un dossier perdu", () => {
    // Proposer « relancer » rouvrirait un dossier délibérément fermé.
    expect(deriveProspectNextAction(facts({ status: "PERDU" }))).toBeNull();
  });
});

describe("describeProspectRelation", () => {
  it("dit CLIENT dès qu'une fiche existe, quel que soit le statut du prospect", () => {
    expect(describeProspectRelation({ status: "NEGOCIATION", establishmentId: "e1" })).toBe("CLIENT");
  });

  it("dit PROSPECT tant que la conversion n'a pas eu lieu, même au statut signé", () => {
    // `Prospect.status = SIGNE` dit que le devis est signé, pas que la fiche existe.
    expect(describeProspectRelation({ status: "SIGNE", establishmentId: null })).toBe("PROSPECT");
  });

  it("dit PERDU sur un dossier fermé", () => {
    expect(describeProspectRelation({ status: "PERDU", establishmentId: null })).toBe("PERDU");
  });
});
