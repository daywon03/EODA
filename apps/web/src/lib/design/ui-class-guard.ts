// Garde-fous d'accessibilité sur les classes Tailwind — fonctions pures.
//
// CLAUDE.md §6 exigeait un texte d'au moins 14 px et un focus toujours visible,
// sans aucun contrôle : une règle qu'aucune machine ne vérifie est un souhait
// (Règle zéro). Ces fonctions lisent un fichier source et listent ce qui
// l'enfreint ; ui-class-guard.test.ts les applique à tout `src/`.

export const MIN_TEXT_PX = 14;
const ROOT_FONT_PX = 16;

export type ClassViolation = {
  line: number;
  match: string;
  reason: string;
};

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

// Taille arbitraire `text-[Npx]`, `text-[Nrem]`, `text-[Nem]`, avec ou sans
// préfixe de variante (`sm:`). L'échelle nommée (`text-xs`…) est contrôlée à part,
// dans tailwind.config.ts : son plancher est 14 px.
const ARBITRARY_TEXT_SIZE = /\btext-\[(\d+(?:\.\d+)?)(px|rem|em)\]/g;

export function findSmallTextSizes(source: string): ClassViolation[] {
  const violations: ClassViolation[] = [];
  for (const m of source.matchAll(ARBITRARY_TEXT_SIZE)) {
    const value = Number(m[1]);
    const px = m[2] === "px" ? value : value * ROOT_FONT_PX;
    if (px < MIN_TEXT_PX) {
      violations.push({
        line: lineOf(source, m.index ?? 0),
        match: m[0],
        reason: `texte de ${px} px, minimum ${MIN_TEXT_PX} px`,
      });
    }
  }
  return violations;
}

// Tout utilitaire qui retire le contour (« outline » suivi de « none » ou « 0 »), avec ou sans
// variante : globals.css pose un focus ambre de 3 px sur tout élément focalisable,
// et ces classes, plus spécifiques, l'effaceraient.
const OUTLINE_REMOVAL = /(?<![\w-])(?:[\w-]+:)*outline-(?:none|0)(?![\w-])/g;

export function findFocusSuppression(source: string): ClassViolation[] {
  return [...source.matchAll(OUTLINE_REMOVAL)].map((m) => ({
    line: lineOf(source, m.index ?? 0),
    match: m[0],
    reason: "retire le contour de focus (3 px ambre, globals.css)",
  }));
}

// Teintes de charte qui ne tiennent PAS 4.5:1 en texte sur le papier clair
// (theme-contrast.test.ts le prouve) : `gris-mid` (≈ 3.7:1, réservé aux bordures et
// au décor) et `terre` (4.29:1, réservé à l'APLAT). En texte, on écrit `text-ink2`
// (secondaire) ou `text-accent-text` (terre assombri). `muted` est un alias de
// `gris-mid`. Les variantes (`hover:`, `placeholder:`) et l'opacité (`/60`) sont
// refusées de même : un texte survolé ou un placeholder reste un texte.
// Depuis l'audit du 14/10/2026, `ambre` (≈ 2.4:1) et `vert-ok` (≈ 2.6:1) aussi :
// aplats seulement ; en texte ou en icône, `text-amber-text` et `text-ok-text`.
export const LOW_CONTRAST_TEXT_TOKENS = ["gris-mid", "terre", "muted", "ambre", "vert-ok"] as const;
const LOW_CONTRAST_TEXT = /(?<![\w-])(?:[\w-]+:)*text-(gris-mid|terre|muted|ambre|vert-ok)(?:\/\d+)?(?![\w-])/g;

const REPLACEMENT: Record<(typeof LOW_CONTRAST_TEXT_TOKENS)[number], string> = {
  "gris-mid": "text-ink2",
  muted: "text-ink2",
  terre: "text-accent-text",
  ambre: "text-amber-text",
  "vert-ok": "text-ok-text",
};

export function findLowContrastTextColors(source: string): ClassViolation[] {
  return [...source.matchAll(LOW_CONTRAST_TEXT)].map((m) => ({
    line: lineOf(source, m.index ?? 0),
    match: m[0],
    reason: `${m[1]} en texte < 4.5:1 sur le papier — utiliser ${REPLACEMENT[m[1] as keyof typeof REPLACEMENT]}`,
  }));
}

// Lit l'entrée `fontSize.xs` de la configuration Tailwind et la convertit en px.
export function fontSizeToPx(size: string): number {
  const m = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(size.trim());
  if (!m) throw new Error(`Taille non reconnue « ${size} »`);
  return m[2] === "px" ? Number(m[1]) : Number(m[1]) * ROOT_FONT_PX;
}
