import { describe, expect, it } from "vitest";
import { detectStampSource, findStampBox, inkMask, needsQuarterTurn, paperToTransparent, stampQuarterTurns } from "./stamp-image-service";

// Une page blanche de 200 × 300, avec des rectangles d'encre noire.
function page(width: number, height: number, inked: { x: number; y: number; w: number; h: number }[]) {
  const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const r of inked) {
    for (let y = r.y; y < r.y + r.h; y += 1) {
      for (let x = r.x; x < r.x + r.w; x += 1) {
        const i = (y * width + x) * 4;
        rgba[i] = 20;
        rgba[i + 1] = 30;
        rgba[i + 2] = 120; // encre bleue de tampon
      }
    }
  }
  return rgba;
}

describe("le tampon dans le scan", () => {
  it("l'encre se reconnaît quelle que soit sa couleur, le papier non", () => {
    const rgba = page(4, 1, [{ x: 0, y: 0, w: 1, h: 1 }]);
    rgba.set([200, 30, 30, 255], 4); // rouge de tampon
    rgba.set([240, 240, 240, 255], 8); // papier un peu gris
    expect([...inkMask(rgba, 4, 1)]).toEqual([1, 1, 0, 0]);
  });

  it("garde la plus grosse tache : ni la poussière, ni le second coup de tampon plus pâle", () => {
    const width = 200;
    const height = 300;
    // Tampon 1 : cinq « lignes » de lettres rapprochées (le même tampon) ;
    // tampon 2 : plus petit, loin ; poussières dans le coin.
    const lines = [0, 1, 2, 3, 4].map((k) => ({ x: 40, y: 40 + k * 12, w: 100, h: 6 }));
    const rgba = page(width, height, [...lines, { x: 60, y: 200, w: 60, h: 6 }, { x: 60, y: 212, w: 60, h: 6 }, { x: 190, y: 290, w: 3, h: 3 }]);
    const box = findStampBox(inkMask(rgba, width, height), width, height)!;
    // Les cinq lignes, marge d'une case (8 px) comprise.
    expect(box.x).toBeLessThanOrEqual(40);
    expect(box.y).toBeLessThanOrEqual(40);
    expect(box.x + box.width).toBeGreaterThanOrEqual(140);
    expect(box.y + box.height).toBeGreaterThanOrEqual(94);
    expect(box.y + box.height).toBeLessThan(200);
  });

  it("une page blanche n'a pas de tampon", () => {
    expect(findStampBox(new Uint8Array(64 * 64), 64, 64)).toBeNull();
  });

  it("le cadre ne sort jamais de l'image", () => {
    const rgba = page(40, 40, [{ x: 0, y: 0, w: 40, h: 40 }]);
    expect(findStampBox(inkMask(rgba, 40, 40), 40, 40)).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });
});

describe("le sens du tampon", () => {
  it("plus haut que large : un quart de tour ; sinon, rien", () => {
    expect(needsQuarterTurn({ width: 100, height: 240 })).toBe(true);
    expect(needsQuarterTurn({ width: 240, height: 100 })).toBe(false);
    expect(stampQuarterTurns({ width: 100, height: 240 }, null)).toBe(1);
    expect(stampQuarterTurns({ width: 240, height: 100 }, null)).toBe(0);
  });

  it("le choix fait à l'écran l'emporte, ramené entre 0 et 3", () => {
    expect(stampQuarterTurns({ width: 100, height: 240 }, 3)).toBe(3);
    expect(stampQuarterTurns({ width: 100, height: 240 }, 5)).toBe(1);
    expect(stampQuarterTurns({ width: 100, height: 240 }, -1)).toBe(3);
  });
});

describe("le papier devient transparent", () => {
  it("papier invisible, encre opaque, demi-teinte entre les deux", () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 20, 30, 120, 255, 180, 180, 180, 255]);
    paperToTransparent(rgba);
    expect(rgba[3]).toBe(0);
    expect(rgba[7]).toBe(255);
    expect(rgba[11]).toBeGreaterThan(0);
    expect(rgba[11]).toBeLessThan(255);
    // la couleur de l'encre est gardée
    expect([...rgba.slice(4, 7)]).toEqual([20, 30, 120]);
  });
});

describe("le fichier déposé", () => {
  it("se reconnaît à sa signature", () => {
    expect(detectStampSource(new TextEncoder().encode("%PDF-1.4"))).toBe("PDF");
    expect(detectStampSource(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("IMAGE");
    expect(detectStampSource(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("IMAGE");
    expect(detectStampSource(new TextEncoder().encode("PK\u0003\u0004"))).toBeNull();
  });
});
