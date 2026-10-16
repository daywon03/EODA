import { describe, expect, it } from "vitest";
import { ANALYSIS_UNAVAILABLE_LINE, clientWaitingLine } from "./client-document-waiting-service";

// Constaté au test de bout en bout (12/10/2026) : en autonomie, un document dont
// l'analyse n'a pas abouti affichait « La plateforme lit votre document » pour
// toujours. L'analyse tourne PENDANT le dépôt (document-ingestion-service) : une
// fois la carte affichée, une version reçue sans analyse lisible n'attend plus
// rien. Il faut le dire, et rassurer sur l'essentiel — le document est bien reçu.
describe("phrase d'attente d'une carte « Mes documents »", () => {
  it("autonomie : reçu sans analyse lisible = analyse indisponible, pas un chargement", () => {
    expect(clientWaitingLine("IN_PROGRESS", "AUTONOMIE")).toBe(ANALYSIS_UNAVAILABLE_LINE);
    expect(ANALYSIS_UNAVAILABLE_LINE).toMatch(/^Analyse indisponible — votre document est bien reçu\./);
  });

  it("accompagné : EODA relit, l'attente est réelle", () => {
    expect(clientWaitingLine("IN_PROGRESS", "ACCOMPAGNE")).toBe("EODA relit ce document.");
  });

  it("document déclaré absent : à produire ou à créer selon le mode", () => {
    expect(clientWaitingLine("TO_PRODUCE", "ACCOMPAGNE")).toBe("Vous ne l'avez pas : il est à produire.");
    expect(clientWaitingLine("TO_PRODUCE", "AUTONOMIE")).toBe("Vous ne l'avez pas : il est à créer.");
  });

  it("rien à dire pour les autres états", () => {
    for (const state of ["TO_DEPOSIT", "RENEW", "TO_CHECK", "ACCEPTED", "NOT_CONCERNED"] as const) {
      expect(clientWaitingLine(state, "AUTONOMIE")).toBeNull();
    }
  });
});
