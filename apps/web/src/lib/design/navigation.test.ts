import { describe, expect, it } from "vitest";
import { accessibleItemLabel, initialsOf, matchLength, pluralize, resolveActiveItem, type NavItem } from "./navigation";
import { buildClientNav, CLIENT_ACCOUNT_LINKS, CLIENT_MESSAGES_PATH } from "./client-navigation";
import {
  parseSidebarState,
  readSidebarState,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_PX,
  writeSidebarState,
} from "./sidebar-preference";

const item = (over: Partial<NavItem> = {}): NavItem => ({
  id: "x",
  href: "/a",
  label: "A",
  icon: "documents",
  ...over,
});

describe("matchLength", () => {
  it("préfixe : l'adresse et ses sous-pages, pas un nom voisin", () => {
    expect(matchLength(item(), "/a")).toBe(2);
    expect(matchLength(item(), "/a/b")).toBe(2);
    expect(matchLength(item(), "/ab")).toBe(-1);
  });

  it("exact : l'adresse seule", () => {
    expect(matchLength(item({ exact: true }), "/a")).toBe(2);
    expect(matchLength(item({ exact: true }), "/a/b")).toBe(-1);
  });

  it("adresses rattachées : la plus spécifique compte", () => {
    expect(matchLength(item({ exact: true, alsoMatches: ["/a/fiches"] }), "/a/fiches/1")).toBe(9);
  });
});

describe("resolveActiveItem", () => {
  it("garde l'entrée la plus spécifique, une seule", () => {
    const sections = [
      { id: "s", label: null, items: [item({ id: "racine", href: "/a" }), item({ id: "fille", href: "/a/b" })] },
    ];
    expect(resolveActiveItem(sections, "/a/b/c")?.id).toBe("fille");
    expect(resolveActiveItem(sections, "/a")?.id).toBe("racine");
    expect(resolveActiveItem(sections, "/z")).toBeNull();
  });
});

describe("libellés", () => {
  it("le nom accessible porte la pastille et le signal", () => {
    expect(accessibleItemLabel(item({ label: "À relire", count: 2, countLabel: "2 documents à relire" }))).toBe(
      "À relire, 2 documents à relire"
    );
    expect(accessibleItemLabel(item({ label: "Messages", attentionLabel: "nouveau message" }))).toBe(
      "Messages, nouveau message"
    );
    expect(accessibleItemLabel(item({ label: "À relire", count: 0, countLabel: "0 document à relire" }))).toBe("À relire");
  });

  it("pluralize", () => {
    expect(pluralize(0, "demande")).toBe("0 demande");
    expect(pluralize(1, "demande")).toBe("1 demande");
    expect(pluralize(4, "demande")).toBe("4 demandes");
  });

  it("initialsOf", () => {
    expect(initialsOf("marie dupont")).toBe("MD");
    expect(initialsOf("Marie Anne Dupont")).toBe("MA");
    expect(initialsOf("  élise ", 1)).toBe("É");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("navigation du portail client", () => {
  it("liste seulement les surfaces qui existent, dans l'ordre", () => {
    expect(buildClientNav({ hasUnansweredMessage: false }).map((i) => i.label)).toEqual([
      "Mes documents",
      "Mes livrables",
      "Mon suivi",
      "Messages",
    ]);
  });

  it("aucun prénom de l'équipe EODA dans les libellés (D7)", () => {
    const labels = [...buildClientNav({ hasUnansweredMessage: true }), ...CLIENT_ACCOUNT_LINKS].map((i) => i.label);
    expect(labels.join(" ")).not.toMatch(/Sandrine/i);
  });

  it("signale un message sans réponse sur Messages seulement", () => {
    const items = buildClientNav({ hasUnansweredMessage: true });
    expect(items.filter((i) => i.attentionLabel).map((i) => i.href)).toEqual([CLIENT_MESSAGES_PATH]);
    expect(buildClientNav({ hasUnansweredMessage: false }).some((i) => i.attentionLabel)).toBe(false);
  });

  it.each([
    ["/dashboard/client", "documents"],
    ["/dashboard/client/livrables", "deliverables"],
    ["/dashboard/client/suivi", "progress"],
    ["/dashboard/client/echanges", "messages"],
    ["/dashboard/client/contrat", null],
  ])("entrée active de %s → %s", (pathname, expected) => {
    const sections = [{ id: "c", label: null, items: buildClientNav({ hasUnansweredMessage: false }) }];
    expect(resolveActiveItem(sections, pathname)?.id ?? null).toBe(expected);
  });

  it("le menu du compte mène au profil et au contrat", () => {
    expect(CLIENT_ACCOUNT_LINKS.map((l) => l.href)).toEqual(["/dashboard/profil", "/dashboard/client/contrat"]);
  });
});

describe("préférence de repli de la barre latérale", () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      data,
    };
  }
  const failing = () => {
    throw new Error("SecurityError");
  };

  it("largeurs de la maquette", () => {
    expect(SIDEBAR_WIDTH_PX).toEqual({ expanded: 264, collapsed: 76 });
  });

  it("toute valeur inconnue vaut « dépliée »", () => {
    expect(parseSidebarState("collapsed")).toBe("collapsed");
    expect(parseSidebarState("n'importe quoi")).toBe("expanded");
    expect(parseSidebarState(null)).toBe("expanded");
  });

  it("lit et écrit la préférence", () => {
    const storage = memoryStorage();
    writeSidebarState(() => storage, "collapsed");
    expect(storage.data.get(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(readSidebarState(() => storage)).toBe("collapsed");
  });

  it("stockage refusé : ni plantage en lecture, ni en écriture", () => {
    expect(readSidebarState(failing)).toBe("expanded");
    expect(() => writeSidebarState(failing, "collapsed")).not.toThrow();
  });
});
