import { describe, expect, it } from "vitest";
import { isSafeDocxHref, neutralizeDocxLinks } from "./docx-preview-safety";

// Un Word déposé par un tiers est dessiné sur notre domaine : ses liens sont une
// entrée hostile.
describe("isSafeDocxHref", () => {
  it("garde http(s), mailto et les signets internes", () => {
    expect(isSafeDocxHref("https://www.has-sante.fr")).toBe(true);
    expect(isSafeDocxHref("http://exemple.fr/a")).toBe(true);
    expect(isSafeDocxHref("mailto:accueil@exemple.fr")).toBe(true);
    expect(isSafeDocxHref("#_Toc123")).toBe(true);
  });

  it("refuse javascript:, data:, vbscript: et les adresses illisibles", () => {
    expect(isSafeDocxHref("javascript:alert(1)")).toBe(false);
    expect(isSafeDocxHref("  JaVaScRiPt:alert(1)")).toBe(false);
    expect(isSafeDocxHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeDocxHref("vbscript:x")).toBe(false);
    expect(isSafeDocxHref("pas une adresse")).toBe(false);
  });
});

// Double minimal d'un nœud DOM : l'environnement de test est Node, sans navigateur.
function fakeLink(href: string) {
  const attributes = new Map<string, string>([["href", href]]);
  return {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
    attributes,
  };
}

describe("neutralizeDocxLinks", () => {
  it("retire l'adresse d'un lien dangereux, ouvre les autres sans référent", () => {
    const links = [fakeLink("javascript:alert(1)"), fakeLink("https://exemple.fr"), fakeLink("#signet")];
    const root = { querySelectorAll: () => links } as unknown as ParentNode;
    expect(neutralizeDocxLinks(root)).toBe(1);
    expect(links[0]!.attributes.has("href")).toBe(false);
    expect(links[1]!.attributes.get("rel")).toBe("noopener noreferrer");
    expect(links[1]!.attributes.get("target")).toBe("_blank");
    expect(links[2]!.attributes.has("target")).toBe(false);
  });
});
