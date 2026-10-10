import { describe, expect, it } from "vitest";
import tailwindConfig from "../../../tailwind.config";
import { AA_NORMAL_TEXT, contrastRatio, type Rgb } from "./contrast";
import { RATING_PALETTE, RATING_SCALE, RATING_TOKEN } from "./rating-palette";

// Règle zéro : « couleurs cot-* réservées, texte lisible dessus » ne tient que si
// une machine recalcule le contraste et vérifie que la palette suit la config.

function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const TEXT: Record<"white" | "black", Rgb> = { white: [255, 255, 255], black: [0, 0, 0] };

const configColors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, unknown>;

describe("palette de cotation", () => {
  it("couvre toute l'échelle 1/2/3/4/★/NC/RI", () => {
    expect([...RATING_SCALE].sort()).toEqual(Object.keys(RATING_PALETTE).sort());
  });

  it.each(RATING_SCALE)("%s : même teinte que tailwind.config.ts", (rating) => {
    expect(String(configColors[RATING_TOKEN[rating]]).toUpperCase()).toBe(RATING_PALETTE[rating].hex.toUpperCase());
  });

  it.each(RATING_SCALE)("%s : texte ≥ 4.5:1 sur la teinte", (rating) => {
    const swatch = RATING_PALETTE[rating];
    expect(contrastRatio(hexToRgb(swatch.hex), TEXT[swatch.textOn])).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(swatch.selectedClass).toContain(`text-${swatch.textOn}`);
    expect(swatch.selectedClass).toContain(`bg-${RATING_TOKEN[rating]}`);
  });
});
