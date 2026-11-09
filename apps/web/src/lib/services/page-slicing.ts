// Découper une page Word dessinée d'un seul tenant en pages A4 (copie PDF d'un contrat
// signé, 08/11/2026). docx-preview ne coupe que sur les sauts de page écrits dans le
// Word : un contrat sans saut explicite sort en une seule longue page.
//
// On coupe ENTRE deux blocs (paragraphe, ligne de tableau) dont on connaît le bas,
// jamais au milieu d'une ligne de texte — sauf si un bloc seul dépasse une page, où
// l'on coupe à la limite. Chaque page garde les marges de la page Word : la première
// commence en haut de la page dessinée (sa marge y est déjà), les suivantes sont
// posées sous une marge haute égale.

export type PageSlice = { from: number; to: number; drawAt: number };

export function planPageSlices(input: {
  total: number; // hauteur de la page dessinée (marges comprises)
  pageHeight: number; // hauteur d'une page A4 à la même échelle
  marginTop: number;
  marginBottom: number;
  boundaries: readonly number[]; // bas des blocs, depuis le haut de la page dessinée
}): PageSlice[] {
  const { total, pageHeight, marginTop, marginBottom } = input;
  const end = Math.max(0, total - marginBottom);
  if (end <= pageHeight - marginBottom) return [{ from: 0, to: total, drawAt: 0 }];
  const cuts = [...new Set(input.boundaries)].filter((b) => b > 0 && b < end).sort((a, b) => a - b);
  const slices: PageSlice[] = [];
  let from = 0;
  while (from < end) {
    const first = slices.length === 0;
    const capacity = first ? pageHeight - marginBottom : pageHeight - marginTop - marginBottom;
    const limit = from + capacity;
    if (limit >= end) {
      slices.push({ from, to: end, drawAt: first ? 0 : marginTop });
      break;
    }
    // La dernière coupure possible, pourvu qu'elle remplisse au moins la moitié de la page.
    const fits = cuts.filter((c) => c > from + capacity / 2 && c <= limit);
    const to = fits.length > 0 ? fits[fits.length - 1]! : limit;
    slices.push({ from, to, drawAt: first ? 0 : marginTop });
    from = to;
  }
  return slices;
}
