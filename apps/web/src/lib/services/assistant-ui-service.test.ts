import { describe, expect, it } from "vitest";
import { firstName, groupConversationsByDate } from "./assistant-ui-service";

describe("groupConversationsByDate — l'historique comme ChatGPT / Claude", () => {
  const now = new Date(2026, 10, 11, 15, 0);
  const at = (d: number, h = 10) => new Date(2026, 10, d, h);
  it("Aujourd'hui, Hier, 7 derniers jours, Plus ancien — groupes vides retirés, ordre gardé", () => {
    const groups = groupConversationsByDate(
      [
        { id: "a", title: "A", updatedAt: at(11, 9) },
        { id: "b", title: "B", updatedAt: at(10, 23) },
        { id: "c", title: "C", updatedAt: at(6) },
        { id: "d", title: "D", updatedAt: new Date(2026, 9, 1) },
      ],
      now
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Aujourd'hui", ["a"]],
      ["Hier", ["b"]],
      ["7 derniers jours", ["c"]],
      ["Plus ancien", ["d"]],
    ]);
  });

  it("aucune conversation : aucun groupe", () => {
    expect(groupConversationsByDate([], now)).toEqual([]);
  });
});

describe("firstName", () => {
  it("le prénom pour saluer, rien d'inventé sans nom", () => {
    expect(firstName("Sandrine Exemple")).toBe("Sandrine");
    expect(firstName("  ")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});
