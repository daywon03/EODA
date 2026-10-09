import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import tailwindConfig from "../../../tailwind.config";
import {
  MIN_TEXT_PX,
  findFocusSuppression,
  findSmallTextSizes,
  fontSizeToPx,
} from "./ui-class-guard";

const SRC = path.resolve(__dirname, "../..");

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    const isSource = /\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry);
    return isSource ? [full] : [];
  });
}

function report(check: (source: string) => { line: number; match: string; reason: string }[]): string[] {
  return listSourceFiles(SRC).flatMap((file) =>
    check(readFileSync(file, "utf8")).map(
      (v) => `${path.relative(SRC, file)}:${v.line} ${v.match} — ${v.reason}`
    )
  );
}

describe("findSmallTextSizes", () => {
  it("refuse les tailles arbitraires sous 14 px, avec ou sans variante", () => {
    const source = `<p className="text-[11px] sm:text-[10px] text-[13.5px]">`;
    expect(findSmallTextSizes(source).map((v) => v.match)).toEqual([
      "text-[11px]",
      "text-[10px]",
      "text-[13.5px]",
    ]);
  });

  it("convertit rem et em sur une base de 16 px", () => {
    expect(findSmallTextSizes(`text-[0.75rem] text-[0.875rem] text-[0.8em]`).map((v) => v.match)).toEqual([
      "text-[0.75rem]",
      "text-[0.8em]",
    ]);
  });

  it("accepte 14 px et plus, et ignore les couleurs arbitraires", () => {
    expect(findSmallTextSizes(`text-[14px] text-[18px] text-[#D69646] text-sm`)).toEqual([]);
  });

  it("donne la ligne fautive", () => {
    expect(findSmallTextSizes(`a\nb\n<span className="text-[12px]" />`)[0]?.line).toBe(3);
  });
});

describe("findFocusSuppression", () => {
  it("refuse outline-none et outline-0, nus ou sous variante", () => {
    const source = `"outline-none focus:outline-none focus-visible:outline-0"`;
    expect(findFocusSuppression(source).map((v) => v.match)).toEqual([
      "outline-none",
      "focus:outline-none",
      "focus-visible:outline-0",
    ]);
  });

  it("laisse passer les autres utilitaires de contour", () => {
    expect(findFocusSuppression(`outline outline-2 outline-offset-2 my-outline-none-thing`)).toEqual([]);
  });
});

describe("fontSizeToPx", () => {
  it("lit px et rem", () => {
    expect(fontSizeToPx("0.875rem")).toBe(14);
    expect(fontSizeToPx("12px")).toBe(12);
  });

  it("refuse une unité inconnue", () => {
    expect(() => fontSizeToPx("small")).toThrow();
  });
});

// ── Règle zéro : la règle appliquée au dépôt réel ─────────────────────────────
describe("dépôt — CLAUDE.md §6 (accessibilité)", () => {
  it("aucun texte sous 14 px écrit en taille arbitraire dans src/", () => {
    expect(report(findSmallTextSizes)).toEqual([]);
  });

  it("aucun utilitaire ne retire le contour de focus dans src/", () => {
    expect(report(findFocusSuppression)).toEqual([]);
  });

  it("le plus petit cran de l'échelle Tailwind (`text-xs`) fait au moins 14 px", () => {
    const scale = tailwindConfig.theme?.extend?.fontSize as Record<string, [string, unknown]> | undefined;
    const xs = scale?.xs?.[0];
    expect(xs).toBeDefined();
    expect(fontSizeToPx(xs ?? "0px")).toBeGreaterThanOrEqual(MIN_TEXT_PX);
  });
});
