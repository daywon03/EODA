// Rapport de contraste WCAG 2.x — fonction pure, sans dépendance.
//
// Sert à VÉRIFIER les paires de tokens du thème (theme-contrast.test.ts) : une
// règle « contraste ≥ 4.5:1 » écrite dans un document ne tient que si une
// machine la recalcule à chaque changement de couleur (Règle zéro).

export type Rgb = readonly [number, number, number];

// Seuils WCAG 2.2 : texte normal (AA), grand texte ou composant d'interface.
export const AA_NORMAL_TEXT = 4.5;
export const AA_LARGE_TEXT = 3;

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

// Lit le format des variables de la charte : canaux bruts « 62 44 38 ».
// Refuse tout le reste plutôt que de deviner : un hex glissé dans globals.css
// casserait les opacités Tailwind (`rgb(#3E2C26 / 0.1)` n'est pas du CSS).
export function parseRgbChannels(value: string): Rgb {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 3) throw new Error(`Canaux RGB attendus, reçu « ${value} »`);
  const [r, g, b] = parts.map((p) => {
    if (!/^\d{1,3}$/.test(p)) throw new Error(`Canal invalide « ${p} » dans « ${value} »`);
    const n = Number(p);
    if (n > 255) throw new Error(`Canal hors bornes « ${p} » dans « ${value} »`);
    return n;
  });
  return [r ?? 0, g ?? 0, b ?? 0];
}
