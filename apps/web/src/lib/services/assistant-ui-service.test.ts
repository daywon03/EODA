import { describe, expect, it } from "vitest";
import { describeAssistantReading, firstName, groupConversationsByDate, readToolsOnly } from "./assistant-ui-service";

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

describe("describeAssistantReading", () => {
  it("dit ce qui a été lu, en clair, dans l'ordre du dossier", () => {
    expect(describeAssistantReading(["search_knowledge", "get_document", "list_structures", "get_document"], 2)).toBe(
      "A lu vos structures, 2 documents et le référentiel HAS · 2 crédits"
    );
  });
  it("un seul document, un crédit", () => {
    expect(describeAssistantReading(["get_document"], 1)).toBe("A lu 1 document · 1 crédit");
  });
  it("les outils qui proposent ne lisent rien, un outil inconnu est ignoré", () => {
    expect(describeAssistantReading(["propose_comment", "outil_inconnu"], 1)).toBe("1 crédit");
  });
  it("rien lu et rien décompté : rien à dire", () => {
    expect(describeAssistantReading([], 0)).toBeNull();
  });
});

describe("readToolsOnly", () => {
  it("ne garde que nos outils de lecture", () => {
    expect(readToolsOnly(["get_document", "propose_comment", "__proto__", "n'importe quoi"])).toEqual(["get_document"]);
  });
});
