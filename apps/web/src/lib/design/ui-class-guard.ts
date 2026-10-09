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

// Lit l'entrée `fontSize.xs` de la configuration Tailwind et la convertit en px.
export function fontSizeToPx(size: string): number {
  const m = /^(\d+(?:\.\d+)?)(px|rem)$/.exec(size.trim());
  if (!m) throw new Error(`Taille non reconnue « ${size} »`);
  return m[2] === "px" ? Number(m[1]) : Number(m[1]) * ROOT_FONT_PX;
}
