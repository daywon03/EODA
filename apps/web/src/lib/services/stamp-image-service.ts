// ─────────────────────────────────────────────────────────────────────────────
// LE TAMPON DE LA STRUCTURE, PRÊT À POSER SUR LE FORMULAIRE DU DÉPARTEMENT —
// règles PURES (demande de Damon, 30/10/2026 : « mettre le tampon dans la case SAD
// de l'attestation »).
//
// Le tampon arrive comme on l'a sous la main : une feuille tamponnée puis scannée
// (PDF ou photo), parfois tournée, parfois tamponnée deux fois, avec des poussières.
// On ne demande pas à la structure de le détourer : la tablette
//  1. repère l'ENCRE (pixels sombres, quelle que soit la couleur) ;
//  2. garde la plus grosse tache d'encre — un tampon, pas les poussières ni le second
//     coup de tampon — en regroupant les lettres voisines par une grille dilatée ;
//  3. le remet à l'horizontale d'un quart de tour quand il est plus haut que large
//     (un tampon d'adresse est toujours plus large que haut) ; le sens se corrige
//     d'un geste à l'écran si le scan était tourné dans l'autre ;
//  4. rend le papier TRANSPARENT : posé sur le formulaire, le tampon ne masque pas
//     le cadre de la case, comme une encre.
// Document institutionnel : aucune donnée de personne ici.
// ─────────────────────────────────────────────────────────────────────────────

export type InkBox = { x: number; y: number; width: number; height: number };
type Pixels = Uint8Array | Uint8ClampedArray;

// En dessous : de l'encre (noir, bleu ou rouge de tampon) ; au-dessus : le papier.
export const INK_LUMINANCE = 170;
// Taille d'une case de la grille, en pixels de l'image (à 1 240 px de large, une
// lettre de tampon fait 15 à 30 px).
export const STAMP_CELL = 8;
// Deux cases d'encre séparées de moins de DILATION cases appartiennent au même tampon.
const DILATION = 2;
// Une case dont moins de 3 % des pixels sont de l'encre est du grain de scan.
const CELL_MIN_INK = Math.ceil(STAMP_CELL * STAMP_CELL * 0.03);

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function inkMask(rgba: Pixels, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const alpha = rgba[i * 4 + 3]!;
    if (alpha > 128 && luminance(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!) < INK_LUMINANCE) mask[i] = 1;
  }
  return mask;
}

// Le cadre de la plus grosse tache d'encre, marge d'une case comprise ; null si la
// page est blanche.
export function findStampBox(mask: Uint8Array, width: number, height: number, cell = STAMP_CELL): InkBox | null {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const ink = new Uint32Array(cols * rows);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) if (mask[y * width + x]) ink[Math.floor(y / cell) * cols + Math.floor(x / cell)]! += 1;
  }
  const minInk = Math.min(CELL_MIN_INK, Math.ceil(cell * cell * 0.03));
  const inked = (c: number) => ink[c]! >= minInk;

  // Regroupement : deux cases encrées à moins de DILATION cases l'une de l'autre sont
  // reliées. Parcours en largeur, sans récursion (une page entière ne déborde pas la pile).
  const component = new Int32Array(cols * rows).fill(-1);
  let best: { ink: number; minC: number; maxC: number; minR: number; maxR: number } | null = null;
  for (let start = 0; start < cols * rows; start += 1) {
    if (!inked(start) || component[start] !== -1) continue;
    const current = { ink: 0, minC: cols, maxC: -1, minR: rows, maxR: -1 };
    const queue = [start];
    component[start] = start;
    while (queue.length > 0) {
      const c = queue.pop()!;
      const col = c % cols;
      const row = Math.floor(c / cols);
      current.ink += ink[c]!;
      current.minC = Math.min(current.minC, col);
      current.maxC = Math.max(current.maxC, col);
      current.minR = Math.min(current.minR, row);
      current.maxR = Math.max(current.maxR, row);
      for (let dr = -DILATION; dr <= DILATION; dr += 1) {
        for (let dc = -DILATION; dc <= DILATION; dc += 1) {
          const r2 = row + dr;
          const c2 = col + dc;
          if (r2 < 0 || r2 >= rows || c2 < 0 || c2 >= cols) continue;
          const n = r2 * cols + c2;
          if (inked(n) && component[n] === -1) {
            component[n] = start;
            queue.push(n);
          }
        }
      }
    }
    if (!best || current.ink > best.ink) best = current;
  }
  if (!best) return null;
  const x = Math.max(0, (best.minC - 1) * cell);
  const y = Math.max(0, (best.minR - 1) * cell);
  return { x, y, width: Math.min(width, (best.maxC + 2) * cell) - x, height: Math.min(height, (best.maxR + 2) * cell) - y };
}

// Plus haut que large : le scan est tourné d'un quart de tour.
export function needsQuarterTurn(box: Pick<InkBox, "width" | "height">): boolean {
  return box.height > box.width * 1.15;
}

// Quarts de tour à appliquer, entre 0 et 3 : le choix de l'écran s'il existe, sinon la
// règle ci-dessus (un quart de tour dans le sens des aiguilles d'une montre).
export function stampQuarterTurns(box: Pick<InkBox, "width" | "height">, chosen: number | null): number {
  if (chosen !== null && Number.isInteger(chosen)) return ((chosen % 4) + 4) % 4;
  return needsQuarterTurn(box) ? 1 : 0;
}

// Le papier devient transparent, l'encre reste (sa couleur, son opacité selon sa
// densité : un tampon pâle reste pâle). Écrit en place.
const PAPER = 235;
const SOLID_INK = 120;
export function paperToTransparent(rgba: Pixels): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = luminance(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    const opacity = lum >= PAPER ? 0 : lum <= SOLID_INK ? 1 : (PAPER - lum) / (PAPER - SOLID_INK);
    rgba[i + 3] = Math.round(rgba[i + 3]! * opacity);
  }
}

// Le fichier déposé : un PDF (scan) ou une image, reconnu par sa SIGNATURE.
export type StampSourceKind = "PDF" | "IMAGE";
export function detectStampSource(bytes: Uint8Array): StampSourceKind | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "PDF";
  if (starts([0x89, 0x50, 0x4e, 0x47]) || starts([0xff, 0xd8, 0xff])) return "IMAGE";
  return null;
}
