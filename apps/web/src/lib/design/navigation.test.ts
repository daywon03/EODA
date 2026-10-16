import { describe, expect, it } from "vitest";
import {
  accessibleItemLabel,
  initialsOf,
  isSectionOpen,
  matchLength,
  pluralize,
  resolveActiveItem,
  sectionHoldsActiveItem,
  type NavItem,
} from "./navigation";
import { buildClientNav, CLIENT_ACCOUNT_LINKS, CLIENT_MESSAGES_PATH, clientAccountLinks } from "./client-navigation";
import {
  CABINET_SIDEBAR_KEY,
  CLIENT_SIDEBAR_KEY,
  parseSidebarState,
  readSidebarState,
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

describe("sections repliables", () => {
  const main = { id: "main", label: null as string | null, items: [item({ id: "home", href: "/a" })] };
  const reglages = {
    id: "reglages",
    label: "Réglages",
    collapsible: true as const,
    items: [item({ id: "criteria", href: "/r" }), item({ id: "team", href: "/t" })],
  };
  const activeOn = (pathname: string) => resolveActiveItem([main, reglages], pathname);

  it("une section ordinaire est toujours ouverte", () => {
    expect(isSectionOpen(main, null, null)).toBe(true);
    expect(isSectionOpen(main, null, false)).toBe(true);
  });

  it("sans choix mémorisé, elle s'ouvre quand la page courante est dedans", () => {
    expect(isSectionOpen(reglages, activeOn("/r"), null)).toBe(true);
    expect(isSectionOpen(reglages, activeOn("/t"), null)).toBe(true);
    expect(isSectionOpen(reglages, activeOn("/a"), null)).toBe(false);
    expect(isSectionOpen(reglages, null, null)).toBe(false);
  });

  it("un choix du poste l'emporte, y compris pour refermer la section où l'on est", () => {
    expect(isSectionOpen(reglages, activeOn("/a"), true)).toBe(true);
    expect(isSectionOpen(reglages, activeOn("/r"), false)).toBe(false);
  });

  it("reconnaît la page courante par l'entrée active, pas par un préfixe d'adresse", () => {
    // « Structures » est la racine du cabinet et revendique presque toutes ses
    // adresses : une section ne doit pas s'ouvrir parce qu'on est ailleurs.
    const racine = { id: "m", label: null, items: [item({ id: "structures", href: "/dashboard" })] };
    const autre = { id: "r", label: "Réglages", collapsible: true as const, items: [item({ id: "team", href: "/t" })] };
    const sections = [racine, autre];
    const active = resolveActiveItem(sections, "/dashboard/structures");
    expect(sectionHoldsActiveItem(autre, active)).toBe(false);
    expect(isSectionOpen(autre, active, null)).toBe(false);
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
    expect(buildClientNav({ hasUnansweredMessage: false, accessRole: "DIRECTION" }).map((i) => i.label)).toEqual([
      "Accueil",
      "Mes documents",
      "Mon diagnostic",
      "Tâches",
      "Mes livrables",
      "Mon suivi",
      "Messages",
      "Mon équipe",
      "Personnes accompagnées",
      "Enquêtes",
      "Paramètres",
    ]);
  });

  it("suit le rôle d'accès dans la structure (N9)", () => {
    const ids = (accessRole: "RESPONSABLE_QUALITE" | "ADMINISTRATIF" | "INTERVENANT") =>
      buildClientNav({ hasUnansweredMessage: false, accessRole }).map((i) => i.id);
    expect(ids("RESPONSABLE_QUALITE")).not.toContain("settings");
    expect(ids("RESPONSABLE_QUALITE")).toContain("diagnostic");
    expect(ids("ADMINISTRATIF")).toEqual(["home", "documents", "tasks", "deliverables", "messages"]);
    expect(ids("INTERVENANT")).toEqual(["home", "tasks", "team"]);
  });

  it("« Mon contrat » n'est proposé qu'au rôle qui voit le contrat", () => {
    expect(clientAccountLinks("DIRECTION").map((l) => l.id)).toContain("contract");
    expect(clientAccountLinks("RESPONSABLE_QUALITE").map((l) => l.id)).not.toContain("contract");
    expect(clientAccountLinks(null).map((l) => l.id)).toContain("profile");
  });

  it("aucun prénom de l'équipe EODA dans les libellés (D7)", () => {
    const labels = [...buildClientNav({ hasUnansweredMessage: true, accessRole: "DIRECTION" }), ...CLIENT_ACCOUNT_LINKS].map((i) => i.label);
    expect(labels.join(" ")).not.toMatch(/Sandrine/i);
  });

  it("signale un message sans réponse sur Messages seulement", () => {
    const items = buildClientNav({ hasUnansweredMessage: true, accessRole: "DIRECTION" });
    expect(items.filter((i) => i.attentionLabel).map((i) => i.href)).toEqual([CLIENT_MESSAGES_PATH]);
    expect(buildClientNav({ hasUnansweredMessage: false, accessRole: "DIRECTION" }).some((i) => i.attentionLabel)).toBe(false);
  });

  it.each([
    ["/dashboard/client", "home"],
    ["/dashboard/client/documents", "documents"],
    ["/dashboard/client/diagnostic", "diagnostic"],
    ["/dashboard/client/diagnostic/pratiques", "diagnostic"],
    ["/dashboard/client/livrables", "deliverables"],
    ["/dashboard/client/suivi", "progress"],
    ["/dashboard/client/echanges", "messages"],
    ["/dashboard/client/contrat", null],
  ])("entrée active de %s → %s", (pathname, expected) => {
    const sections = [{ id: "c", label: null, items: buildClientNav({ hasUnansweredMessage: false, accessRole: "DIRECTION" }) }];
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
    writeSidebarState(() => storage, "collapsed", CABINET_SIDEBAR_KEY);
    expect(storage.data.get(CABINET_SIDEBAR_KEY)).toBe("collapsed");
    expect(readSidebarState(() => storage, CABINET_SIDEBAR_KEY)).toBe("collapsed");
  });

  it("stockage refusé : ni plantage en lecture, ni en écriture", () => {
    expect(readSidebarState(failing, CABINET_SIDEBAR_KEY)).toBe("expanded");
    expect(() => writeSidebarState(failing, "collapsed", CABINET_SIDEBAR_KEY)).not.toThrow();
  });

  // Deux coquilles, deux publics, deux postes : replier la barre du cabinet ne doit
  // jamais replier celle du portail client. Une clé commune serait invisible à la
  // relecture — d'où l'affirmation, plutôt que la confiance dans deux littéraux.
  it("le cabinet et le client ne partagent pas leur préférence de repli", () => {
    expect(CLIENT_SIDEBAR_KEY).not.toBe(CABINET_SIDEBAR_KEY);
    const storage = memoryStorage();
    writeSidebarState(() => storage, "collapsed", CABINET_SIDEBAR_KEY);
    expect(readSidebarState(() => storage, CLIENT_SIDEBAR_KEY)).toBe("expanded");
    writeSidebarState(() => storage, "collapsed", CLIENT_SIDEBAR_KEY);
    expect(readSidebarState(() => storage, CLIENT_SIDEBAR_KEY)).toBe("collapsed");
    expect(readSidebarState(() => storage, CABINET_SIDEBAR_KEY)).toBe("collapsed");
  });
});
