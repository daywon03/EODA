import { describe, expect, it } from "vitest";
import {
  countDeliveries,
  devisEmailNotSentMessage,
  invitationDeliveryMessage,
} from "@/lib/services/email-delivery-service";

// Test de bout en bout du 12/10 : sans RESEND_API_KEY, l'adaptateur console
// n'envoie rien — et l'écran annonçait « Invitation envoyée ». Un envoi qui n'a pas
// eu lieu ne s'annonce jamais comme parti.
describe("invitationDeliveryMessage", () => {
  it("SENT : l'invitation est partie, on le dit", () => {
    expect(invitationDeliveryMessage("SENT", "direction@example.org")).toEqual({
      tone: "ok",
      text: "Invitation envoyée à direction@example.org — identifiant et mot de passe compris.",
    });
  });

  it("NOT_CONFIGURED : compte créé, e-mail non envoyé en local", () => {
    const message = invitationDeliveryMessage("NOT_CONFIGURED", "direction@example.org");
    expect(message.tone).toBe("warning");
    expect(message.text).toBe(
      "Compte créé ; e-mail non envoyé en local — transmettez le mot de passe autrement."
    );
    expect(message.text).not.toMatch(/envoyée à/);
  });

  it("FAILED : compte créé, l'e-mail a échoué", () => {
    const message = invitationDeliveryMessage("FAILED", "direction@example.org");
    expect(message.tone).toBe("warning");
    expect(message.text).toMatch(/^Compte créé ; l'e-mail d'invitation n'a pas pu être envoyé/);
  });
});

describe("countDeliveries", () => {
  it("ne compte comme envoyé que ce qui est réellement parti", () => {
    expect(
      countDeliveries([
        { status: "fulfilled", value: "SENT" },
        { status: "fulfilled", value: "NOT_CONFIGURED" },
        { status: "rejected", reason: new Error("x") },
      ])
    ).toEqual({ sent: 1, notConfigured: 1, failed: 1 });
  });

  it("liste vide : rien d'envoyé", () => {
    expect(countDeliveries([])).toEqual({ sent: 0, notConfigured: 0, failed: 0 });
  });
});

describe("devisEmailNotSentMessage", () => {
  it("dit que rien n'est parti et propose le geste manuel", () => {
    const text = devisEmailNotSentMessage();
    expect(text).toMatch(/non envoyé/);
    expect(text).toMatch(/Télécharger/);
    expect(text).not.toMatch(/Réessayez/);
  });
});
