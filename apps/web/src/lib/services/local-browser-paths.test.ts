import { describe, expect, it } from "vitest";
import { findLocalBrowser, localBrowserCandidates } from "./local-browser-paths";

describe("localBrowserCandidates", () => {
  it("cherche les navigateurs installés sur macOS, Chrome d'abord", () => {
    const candidates = localBrowserCandidates("darwin");
    expect(candidates[0]).toBe("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    expect(candidates.length).toBeGreaterThan(1);
  });

  it("ne propose rien pour une plateforme sans navigateur connu", () => {
    expect(localBrowserCandidates("aix")).toEqual([]);
  });
});

describe("findLocalBrowser", () => {
  it("rend le premier chemin qui existe", () => {
    expect(
      findLocalBrowser({
        platform: "darwin",
        exists: (path) => path.includes("Chromium.app"),
      })
    ).toBe("/Applications/Chromium.app/Contents/MacOS/Chromium");
  });

  it("ne rend rien quand aucun navigateur n'est installé", () => {
    expect(findLocalBrowser({ platform: "darwin", exists: () => false })).toBeNull();
  });

  it("n'essaie jamais un chemin Windows sur macOS", () => {
    const seen: string[] = [];
    findLocalBrowser({
      platform: "darwin",
      exists: (path) => {
        seen.push(path);
        return false;
      },
    });
    expect(seen.some((path) => path.endsWith(".exe"))).toBe(false);
  });
});
