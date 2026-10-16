import { describe, expect, it } from "vitest";
import {
  buildClientNav,
  clearDeliverablesCount,
  CLIENT_MAX_PRIMARY_ENTRIES,
  splitClientNav,
} from "./client-navigation";

// Ce qui est vérifié ici : la navigation client tient sur UNE ligne à 1440 px et
// dans une barre du bas de 5 cases à 390 px (test de bout en bout du 12/10 : sept
// entrées passaient à la ligne et sortaient de l'écran). Les entrées secondaires
// vont dans « Plus » — aucune ne disparaît, aucune n'est dupliquée.

const items = buildClientNav({ hasUnansweredMessage: false, accessRole: "DIRECTION" });

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
    expect(more.map((i) => i.id)).toEqual(["tasks", "deliverables", "progress", "team", "people", "surveys", "settings"]);
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

// ── Pastille des livrables remis (27/09/2026) ─────────────────────────────────
//
// « Mes livrables » est une entrée SECONDAIRE : sa pastille vit donc dans un menu
// fermé. Sans report du nombre sur le bouton « Plus », personne ne saurait qu'il y a
// du nouveau — c'est la seule raison d'être de `moreCount`.
describe("nouveaux livrables — compteur et extinction", () => {
  const withCount = (count: number) =>
    buildClientNav({ hasUnansweredMessage: false, accessRole: "DIRECTION", newDeliverablesCount: count });

  it("ne pose aucune pastille quand il n'y a rien de nouveau", () => {
    const entry = withCount(0).find((i) => i.id === "deliverables");
    expect(entry?.count).toBeUndefined();
    expect(entry?.countLabel).toBeUndefined();
  });

  it("porte le nombre ET ce qu'il compte — un chiffre seul ne dit rien à l'oral", () => {
    const one = withCount(1).find((i) => i.id === "deliverables");
    expect(one?.count).toBe(1);
    expect(one?.countLabel).toBe("1 nouveau document");

    const three = withCount(3).find((i) => i.id === "deliverables");
    expect(three?.count).toBe(3);
    expect(three?.countLabel).toBe("3 nouveaux documents");
  });

  it("reporte le nombre sur « Plus », qui est le seul bouton visible", () => {
    expect(splitClientNav(withCount(2), "/dashboard/client").moreCount).toBe(2);
    expect(splitClientNav(withCount(0), "/dashboard/client").moreCount).toBe(0);
  });

  it("éteint le compteur des livrables à la lecture, et rien d'autre", () => {
    const flagged = withCount(2).map((i) =>
      i.id === "messages" ? { ...i, count: 7, countLabel: "7 messages" } : i
    );
    const cleared = clearDeliverablesCount(flagged);

    expect(cleared.find((i) => i.id === "deliverables")?.count).toBeUndefined();
    expect(cleared.find((i) => i.id === "messages")?.count).toBe(7);
    // Les autres entrées sont rendues TELLES QUELLES : une copie recréée ferait
    // perdre silencieusement un champ ajouté plus tard (alsoMatches, attentionLabel).
    expect(cleared.find((i) => i.id === "messages")).toBe(flagged.find((i) => i.id === "messages"));
    expect(cleared.find((i) => i.id === "home")).toBe(flagged.find((i) => i.id === "home"));
  });

  it("ne fabrique pas de pastille en éteignant un compteur déjà absent", () => {
    const cleared = clearDeliverablesCount(withCount(0));
    expect(cleared.find((i) => i.id === "deliverables")?.count).toBeUndefined();
    expect(cleared).toEqual(withCount(0));
  });
});
