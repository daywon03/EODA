import { describe, expect, it } from "vitest";
import {
  canClientPostMessage,
  displayAuthor,
  hasUnansweredMessage,
  MAX_MESSAGE_LENGTH,
  sortThread,
  validateMessageBody,
} from "./message-thread-service";

describe("validateMessageBody", () => {
  it("refuse un message vide ou blanc", () => {
    expect(validateMessageBody(null)).toEqual({ ok: false, error: "Le message est vide." });
    expect(validateMessageBody("   \n ")).toEqual({ ok: false, error: "Le message est vide." });
  });

  it("coupe les blancs de bord sans toucher au contenu", () => {
    expect(validateMessageBody("  Bonjour Sandrine  ")).toEqual({
      ok: true,
      body: "Bonjour Sandrine",
    });
  });

  it("refuse au-delà de la longueur maximale plutôt que de tronquer", () => {
    // Tronquer un message envoyé par quelqu'un, c'est lui faire dire autre chose.
    const result = validateMessageBody("a".repeat(MAX_MESSAGE_LENGTH + 1));
    expect(result.ok).toBe(false);
  });

  it("accepte exactement la longueur maximale", () => {
    expect(validateMessageBody("a".repeat(MAX_MESSAGE_LENGTH)).ok).toBe(true);
  });
});

describe("canClientPostMessage", () => {
  it("laisse écrire en mission active et en bibliothèque", () => {
    // §12.5 : « on ne coupe pas leur accès ». La bibliothèque est précisément le
    // moment où le client écrit pour demander une mise à jour.
    expect(canClientPostMessage("ACTIVE")).toBe(true);
    expect(canClientPostMessage("LIBRARY")).toBe(true);
  });

  it("refuse quand l'accès est révoqué", () => {
    expect(canClientPostMessage("REVOKED")).toBe(false);
  });
});

describe("displayAuthor", () => {
  it("préfère le nom du compte", () => {
    expect(displayAuthor({ authorName: "Sandrine Regina", authorSide: "CABINET" })).toBe(
      "Sandrine Regina"
    );
  });

  it("retombe sur le côté plutôt que sur une signature vide", () => {
    expect(displayAuthor({ authorName: "   ", authorSide: "CLIENT" })).toBe("Votre structure");
    expect(displayAuthor({ authorName: null, authorSide: "CABINET" })).toBe("EODA Conseil");
  });
});

describe("sortThread", () => {
  it("lit la conversation dans l'ordre où elle a eu lieu", () => {
    const sorted = sortThread([
      { createdAt: new Date("2026-09-01"), body: "b" },
      { createdAt: new Date("2026-08-01"), body: "a" },
    ]);
    expect(sorted.map((m) => m.body)).toEqual(["a", "b"]);
  });
});

describe("hasUnansweredMessage", () => {
  it("signale un message venu de l'autre côté", () => {
    expect(hasUnansweredMessage([{ authorSide: "CLIENT" }], "CABINET")).toBe(true);
    expect(hasUnansweredMessage([{ authorSide: "CABINET" }], "CABINET")).toBe(false);
  });

  it("ne signale rien sur un fil vide", () => {
    expect(hasUnansweredMessage([], "CABINET")).toBe(false);
  });

  it("ne regarde que le DERNIER message", () => {
    expect(
      hasUnansweredMessage([{ authorSide: "CLIENT" }, { authorSide: "CABINET" }], "CABINET")
    ).toBe(false);
  });
});
