import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyPath } from "./routes";

// La SEULE route publique nouvelle (N10) est le quiz par QR code. Ce test prouve
// qu'elle est exclue de l'authentification de façon EXPLICITE et ÉTROITE : un seul
// segment après /quiz/, et rien d'autre ne devient public par ricochet.
describe("classifyPath — refuser par défaut", () => {
  it.each([
    ["/quiz/abcDEF123_-xyz", "ANONYMOUS"],
    // Tablette terrain (lot C) : l'appareil enregistré + le code font l'autorisation.
    ["/tablette", "ANONYMOUS"],
    ["/tablette/demonstration", "ANONYMOUS"],
    ["/tablette/autre", "PROTECTED"],
    ["/tablette/demonstration/x", "PROTECTED"],
    // Enquête anonyme (21/10/2026) : tablette, et lien à usage unique à un seul segment.
    ["/tablette/enquete", "ANONYMOUS"],
    ["/tablette/enquete/x", "PROTECTED"],
    // Accueil et DIPEC signé (26/10/2026) : oublié le 26/10, la tablette tombait sur /login.
    ["/tablette/admission", "ANONYMOUS"],
    ["/tablette/admission/x", "PROTECTED"],
    // Word d'origine du DIPEC pour la tablette (27/10/2026) : un seul segment.
    ["/api/tablette/dipec/abc123", "ANONYMOUS"],
    ["/api/tablette/dipec", "PROTECTED"],
    ["/api/tablette/dipec/a/b", "PROTECTED"],
    ["/api/tablette/autre/abc", "PROTECTED"],
    // Formulaires officiels vierges : servis hors middleware (matcher), jamais par classifyPath.
    ["/formulaires/93-designation-sad-declaration-initiale-2026.pdf", "PROTECTED"],
    ["/enquete/abcDEF123_-xyz", "ANONYMOUS"],
    ["/enquete", "PROTECTED"],
    ["/enquete/", "PROTECTED"],
    ["/enquete/a/b", "PROTECTED"],
    ["/enquetes/abc", "PROTECTED"],
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

  // Lu sur le DISQUE, pas sur une liste : une page de tablette ajoutée sans être
  // ouverte ici renverrait la tablette vers /login (c'est arrivé le 26/10/2026).
  it("chaque page sous app/tablette est ouverte à l'appareil enregistré, sans session du portail", () => {
    const appDir = path.resolve(__dirname, "../../app/tablette");
    const routes = (readdirSync(appDir, { recursive: true }) as string[])
      .filter((file) => file === "page.tsx" || file.endsWith(`${path.sep}page.tsx`))
      .map((file) => `/tablette${file === "page.tsx" ? "" : `/${path.dirname(file).split(path.sep).join("/")}`}`);
    expect(routes.length).toBeGreaterThanOrEqual(4);
    for (const route of routes) expect(classifyPath(route), route).toBe("ANONYMOUS");
  });

  it("le matcher n'exclut que les formulaires officiels en PDF du dossier /formulaires", () => {
    const middleware = readFileSync(path.resolve(__dirname, "../../middleware.ts"), "utf8");
    const matcher = /matcher: \["\/\(\(\?!(.*)\)\.\*\)"\]/.exec(middleware)?.[1] ?? "";
    const excluded = new RegExp(`^/(?:${matcher.replace(/\\\\/g, "\\")})`);
    expect(excluded.test("/formulaires/93-designation-sad-declaration-initiale-2026.pdf")).toBe(true);
    expect(excluded.test("/formulaires/x.docx")).toBe(false);
    expect(excluded.test("/formulaires/a/b.pdf")).toBe(false);
    expect(excluded.test("/dashboard/client/doc.pdf")).toBe(false);
  });
});
