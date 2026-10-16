import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// RÈGLE ZÉRO (CLAUDE.md §0) — la règle « navigation latérale du portail client »
// n'existe que si une machine la vérifie. Elle est écrite au §4.2 de DESIGN.md ; ce
// fichier est sa contrepartie exécutable.
//
// Ce qui se vérifie ici ne peut pas se vérifier sur les fonctions pures : ce sont des
// propriétés de la COQUILLE (qui reçoit quoi, quel rendu existe à quelle largeur).
// On lit donc la source, comme le fait déjà `ui-class-guard.test.ts` pour la
// typographie et le focus.
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT = path.resolve(__dirname, "../../components/layout");

function read(...parts: string[]): string {
  return readFileSync(path.join(LAYOUT, ...parts), "utf8");
}

const SHELL = read("client/ClientShell.tsx");
const SIDEBAR = read("client/ClientSidebar.tsx");
const NAV_LIST = read("client/ClientNavList.tsx");
const NAV_BAR = read("client/ClientNavBar.tsx");
const CABINET_NAV_LIST = read("cabinet/CabinetNavList.tsx");

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe("coquille client — une seule source de navigation", () => {
  // Le cabinet l'écrit depuis le 09/10 : « une entrée de plus ne s'ajoute jamais à un
  // seul des deux rendus ». Côté client, la barre latérale et la barre du bas sont
  // deux rendus de la MÊME liste : filtrer l'une sans l'autre est exactement le bug
  // que ce test interdit — une entrée disparaîtrait d'un écran sur deux.
  it("la liste est calculée une fois et passée aux deux rendus", () => {
    expect(countOccurrences(SHELL, "buildClientNav(")).toBe(1);
    expect(countOccurrences(SHELL, "items={items}")).toBeGreaterThanOrEqual(2);
  });

  it("la coquille monte la barre latérale, et n'a plus de navigation d'en-tête", () => {
    expect(SHELL).toContain("<ClientSidebar");
    // « variant="top" » était la rangée d'onglets de l'en-tête (avec son menu
    // « Plus ») : remplacée par la barre latérale le 15/10/2026.
    expect(SHELL).not.toContain('variant="top"');
  });

  // Toutes les entrées du portail doivent tenir dans la barre latérale. La répartition
  // « 4 principales + Plus » n'a de sens QUE dans la barre du bas, où la place manque ;
  // l'appliquer ici cacherait sept entrées derrière un menu qui n'existe pas.
  it("la barre latérale rend la liste entière, sans répartition ni troncature", () => {
    expect(NAV_LIST).not.toContain("splitClientNav");
    expect(NAV_LIST).not.toContain("slice(");
    expect(NAV_LIST).not.toContain("primary");
    // La liste part des `items` complets (seul le compteur des livrables s'éteint, et
    // `clearDeliverablesCount` change un chiffre, jamais une entrée).
    expect(NAV_LIST).toContain("useVisibleClientNav(items)");
    expect(NAV_LIST).toContain("visibleItems.map(");
  });

  it("la barre du bas reste le seul rendu sous `lg`, et garde « Plus »", () => {
    expect(NAV_BAR).toContain("lg:hidden");
    expect(NAV_BAR).toContain("splitClientNav");
    // Plus de variante : un seul rendu, donc plus de branches `isTop` à maintenir.
    expect(NAV_BAR).not.toContain('variant === "top"');
    // La barre latérale n'existe qu'à partir de `lg` — en dessous, elle et la barre du
    // bas seraient toutes les deux dans l'arbre d'accessibilité.
    expect(SIDEBAR).toContain("hidden");
    expect(SIDEBAR).toContain("lg:flex");
  });
});

describe("deux densités — le client une taille au-dessus du cabinet", () => {
  // DESIGN.md §3 : le cabinet travaille en 16 px sur des cibles de 44 px, le portail
  // client en 18 px sur des cibles de 48 px. Copier la ligne du cabinet dans la barre
  // latérale du client ferait perdre la seule densité que ce public supporte.
  it("l'entrée de la barre latérale client mesure 48 px, celle du cabinet 44 px", () => {
    expect(NAV_LIST).toContain("h-12");
    expect(NAV_LIST).not.toContain("h-11");
    expect(CABINET_NAV_LIST).toContain("h-11");
  });

  it("le libellé de l'entrée client est en 18 px (text-lg), jamais recopié du cabinet", () => {
    expect(NAV_LIST).toContain("text-lg");
  });

  // Repliée, la barre ne montre que des icônes : le nom accessible doit rester complet
  // (libellé + pastille), sans quoi un lecteur d'écran n'entendrait plus rien.
  it("repliée, chaque entrée porte encore son libellé accessible et sa bulle", () => {
    expect(NAV_LIST).toContain("accessibleItemLabel");
    expect(NAV_LIST).toContain("aria-label={collapsed ? label : undefined}");
    expect(NAV_LIST).toContain("group-hover/item:block group-focus-visible/item:block");
  });
});
