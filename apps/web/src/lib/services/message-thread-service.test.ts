import { describe, expect, it } from "vitest";
import {
  canClientPostMessage,
  dayKey,
  displayAuthor,
  groupMessagesByDay,
  hasUnansweredMessage,
  MAX_MESSAGE_LENGTH,
  relativeDayHeading,
  sortThread,
  startsNewBlock,
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

describe("dayKey", () => {
  it("range un message du soir dans SA journée, pas celle du lendemain", () => {
    // `toISOString()` convertit en UTC : un message du 3 septembre à 23 h 30 en
    // heure d'été française se retrouverait daté du 4.
    expect(dayKey(new Date(2026, 8, 3, 23, 30))).toBe("2026-09-03");
  });
});

describe("relativeDayHeading", () => {
  const now = new Date(2026, 8, 3, 14, 0);

  it("répond d'abord à « est-ce que ça vient de bouger ? »", () => {
    expect(relativeDayHeading(new Date(2026, 8, 3, 9, 0), now)).toBe("Aujourd'hui");
    expect(relativeDayHeading(new Date(2026, 8, 2, 18, 0), now)).toBe("Hier");
  });

  it("écrit la date en toutes lettres au-delà", () => {
    expect(relativeDayHeading(new Date(2026, 7, 28, 10, 0), now)).toContain("août");
  });

  it("gère le passage de mois — la veille du 1er n'est pas le 0", () => {
    expect(relativeDayHeading(new Date(2026, 7, 31, 10, 0), new Date(2026, 8, 1, 10, 0))).toBe("Hier");
  });
});

describe("groupMessagesByDay", () => {
  const now = new Date(2026, 8, 3, 14, 0);

  it("regroupe les messages d'une même journée sous un seul en-tête", () => {
    const groups = groupMessagesByDay(
      [
        { createdAt: new Date(2026, 8, 2, 9, 0) },
        { createdAt: new Date(2026, 8, 3, 9, 0) },
        { createdAt: new Date(2026, 8, 3, 11, 0) },
      ],
      now
    );
    expect(groups.map((g) => g.heading)).toEqual(["Hier", "Aujourd'hui"]);
    expect(groups[1]!.messages).toHaveLength(2);
  });

  it("rend une liste vide sans groupe fantôme", () => {
    expect(groupMessagesByDay([], now)).toEqual([]);
  });
});

describe("startsNewBlock", () => {
  const base = { authorSide: "CLIENT" as const, authorName: "Julien", createdAt: new Date(2026, 8, 3, 9, 0) };

  it("ouvre toujours un bloc sur le premier message", () => {
    expect(startsNewBlock(base, undefined)).toBe(true);
  });

  it("continue le bloc pour une suite immédiate du même auteur", () => {
    expect(startsNewBlock({ ...base, createdAt: new Date(2026, 8, 3, 9, 2) }, base)).toBe(false);
  });

  it("rouvre un bloc après une pause", () => {
    expect(startsNewBlock({ ...base, createdAt: new Date(2026, 8, 3, 9, 30) }, base)).toBe(true);
  });

  it("rouvre un bloc quand l'autre côté répond", () => {
    expect(
      startsNewBlock({ ...base, authorSide: "CABINET", authorName: "Sandrine", createdAt: new Date(2026, 8, 3, 9, 1) }, base)
    ).toBe(true);
  });

  it("rouvre un bloc entre deux personnes du MÊME côté", () => {
    // Masquer le second nom laisserait croire que la directrice a écrit ce que sa
    // secrétaire a écrit.
    expect(
      startsNewBlock({ ...base, authorName: "Tania", createdAt: new Date(2026, 8, 3, 9, 1) }, base)
    ).toBe(true);
  });
});
