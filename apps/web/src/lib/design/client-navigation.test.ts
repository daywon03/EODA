import { describe, expect, it } from "vitest";
import { buildClientNav, CLIENT_MAX_PRIMARY_ENTRIES, splitClientNav } from "./client-navigation";

// Ce qui est vérifié ici : la navigation client tient sur UNE ligne à 1440 px et
// dans une barre du bas de 5 cases à 390 px (test de bout en bout du 12/10 : sept
// entrées passaient à la ligne et sortaient de l'écran). Les entrées secondaires
// vont dans « Plus » — aucune ne disparaît, aucune n'est dupliquée.

const items = buildClientNav({ hasUnansweredMessage: false });

describe("splitClientNav — entrées principales et menu « Plus »", () => {
  it("garde au plus 4 entrées principales, pour que « Plus » soit la 5e case", () => {
    expect(CLIENT_MAX_PRIMARY_ENTRIES).toBe(4);
    const { primary } = splitClientNav(items, "/dashboard/client");
    expect(primary.length).toBeLessThanOrEqual(CLIENT_MAX_PRIMARY_ENTRIES);
  });

  it("place Accueil, Mes documents, Mon diagnostic et Messages en principal (maquette)", () => {
    const { primary } = splitClientNav(items, "/dashboard/client");
    expect(primary.map((i) => i.id)).toEqual(["home", "documents", "diagnostic", "messages"]);
  });

  it("range les autres entrées dans « Plus », dans l'ordre, sans perte ni doublon", () => {
    const { primary, more } = splitClientNav(items, "/dashboard/client");
    expect(more.map((i) => i.id)).toEqual(["tasks", "deliverables", "progress"]);
    const all = [...primary, ...more].map((i) => i.id).sort();
    expect(all).toEqual(items.map((i) => i.id).sort());
  });

  it("signale « Plus » actif quand la page courante est une entrée secondaire", () => {
    expect(splitClientNav(items, "/dashboard/client/livrables").isMoreActive).toBe(true);
    expect(splitClientNav(items, "/dashboard/client/taches/abc").isMoreActive).toBe(true);
    expect(splitClientNav(items, "/dashboard/client/documents").isMoreActive).toBe(false);
    expect(splitClientNav(items, "/dashboard/client/contrat").isMoreActive).toBe(false);
  });

  it("expose l'entrée active, principale ou secondaire", () => {
    expect(splitClientNav(items, "/dashboard/client/diagnostic/pratiques").activeId).toBe("diagnostic");
    expect(splitClientNav(items, "/dashboard/client/suivi").activeId).toBe("progress");
    expect(splitClientNav(items, "/dashboard/client/contrat").activeId).toBeNull();
  });

  it("remonte un signal d'attention porté par une entrée secondaire sur « Plus »", () => {
    const flagged = items.map((i) => (i.id === "progress" ? { ...i, attentionLabel: "nouveau" } : i));
    expect(splitClientNav(flagged, "/dashboard/client").moreAttention).toBe(true);
    expect(splitClientNav(items, "/dashboard/client").moreAttention).toBe(false);
  });

  it("une entrée inconnue (ajoutée plus tard) part dans « Plus », jamais hors écran", () => {
    const extended = [...items, { id: "team", href: "/dashboard/client/equipe", label: "Mon équipe", icon: "home" as const }];
    const { primary, more } = splitClientNav(extended, "/dashboard/client");
    expect(primary.length).toBeLessThanOrEqual(CLIENT_MAX_PRIMARY_ENTRIES);
    expect(more.map((i) => i.id)).toContain("team");
  });
});
