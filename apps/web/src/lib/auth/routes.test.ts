import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyPath } from "./routes";

// La SEULE route publique nouvelle (N10) est le quiz par QR code. Ce test prouve
// qu'elle est exclue de l'authentification de façon EXPLICITE et ÉTROITE : un seul
// segment après /quiz/, et rien d'autre ne devient public par ricochet.
describe("classifyPath — refuser par défaut", () => {
  it.each([
    ["/quiz/abcDEF123_-xyz", "ANONYMOUS"],
    ["/login", "AUTH"],
    ["/login/oubli", "AUTH"],
    ["/quiz", "PROTECTED"],
    ["/quiz/", "PROTECTED"],
    ["/quiz/a/b", "PROTECTED"],
    ["/quiz/a.b", "PROTECTED"],
    ["/quizz/abc", "PROTECTED"],
    ["/dashboard/client", "PROTECTED"],
    ["/dashboard/cabinet/equipe", "PROTECTED"],
    ["/loginx", "PROTECTED"],
  ])("%s → %s", (pathname, expected) => {
    expect(classifyPath(pathname)).toBe(expected);
  });

  it("le middleware s'appuie sur classifyPath et pose la CSP à nonce sur le quiz", () => {
    const middleware = readFileSync(path.resolve(__dirname, "../../middleware.ts"), "utf8");
    expect(middleware).toContain("classifyPath(nextUrl.pathname)");
    expect(middleware).toMatch(/access === "ANONYMOUS"\) return passThroughWithCsp\(/);
    // La page de quiz n'est pas retirée du `matcher` : elle reçoit bien la CSP.
    expect(middleware).not.toMatch(/matcher:[^\]]*quiz/);
  });
});
