import { describe, expect, it } from "vitest";
import { planPageSlices } from "./page-slicing";

const page = { pageHeight: 1000, marginTop: 100, marginBottom: 100 };

describe("découpe d'une page Word dessinée en pages A4", () => {
  it("une page qui tient reste entière", () => {
    expect(planPageSlices({ ...page, total: 950, boundaries: [300, 600] })).toEqual([{ from: 0, to: 950, drawAt: 0 }]);
  });

  it("coupe entre deux blocs, jamais au milieu d'une ligne", () => {
    const slices = planPageSlices({ ...page, total: 2500, boundaries: [400, 850, 880, 1500, 1650, 2300] });
    expect(slices[0]).toEqual({ from: 0, to: 880, drawAt: 0 });
    expect(slices[1]).toEqual({ from: 880, to: 1650, drawAt: 100 });
    expect(slices.at(-1)!.to).toBe(2400);
    for (const s of slices.slice(1)) expect(s.to - s.from).toBeLessThanOrEqual(800);
  });

  it("un bloc plus haut qu'une page est coupé à la limite", () => {
    const slices = planPageSlices({ ...page, total: 2000, boundaries: [1900] });
    expect(slices[0]).toEqual({ from: 0, to: 900, drawAt: 0 });
    expect(slices[1]).toEqual({ from: 900, to: 1700, drawAt: 100 });
  });

  it("couvre toute la page dessinée, sans trou ni recouvrement", () => {
    const slices = planPageSlices({ ...page, total: 4200, boundaries: Array.from({ length: 80 }, (_, i) => 50 * (i + 1)) });
    expect(slices[0]!.from).toBe(0);
    slices.slice(1).forEach((s, i) => expect(s.from).toBe(slices[i]!.to));
    expect(slices.at(-1)!.to).toBe(4100);
  });
});
