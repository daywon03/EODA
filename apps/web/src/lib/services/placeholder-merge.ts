// ─────────────────────────────────────────────────────────────────────────────
// FUSION DE CHAMPS `{{champ}}` DANS UN TEXTE VALIDÉ PAR EODA — service PUR.
//
// Une seule règle pour la feuille de réception (lot C) et le DIPC signé sur la
// tablette (26/10/2026) : on remplace un champ CONNU par sa valeur, on SIGNALE un
// champ inconnu (faute de frappe dans le gabarit) et un champ vide. Ce service
// n'écrit aucune clause ; chaque appelant décide de ce qu'il refuse.
// ─────────────────────────────────────────────────────────────────────────────

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

export function placeholdersIn(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((match) => match[1]!))];
}

export type PlaceholderMerge<F extends string> = {
  text: string;
  unknownFields: string[];
  emptyFields: F[];
};

// `emptyAs` : ce qu'on écrit à la place d'un champ connu mais vide (une ligne à
// compléter à la main, par exemple). Le champ reste compté dans `emptyFields`.
export function mergePlaceholders<F extends string>(
  template: string,
  fields: readonly F[],
  values: Readonly<Record<F, string>>,
  emptyAs = ""
): PlaceholderMerge<F> {
  const isKnown = (name: string): name is F => (fields as readonly string[]).includes(name);
  const used = placeholdersIn(template);
  const unknownFields = used.filter((name) => !isKnown(name));
  const emptyFields = used.filter(isKnown).filter((name) => !values[name].trim());
  const text = template.replace(PLACEHOLDER, (match, name: string) => {
    if (!isKnown(name)) return match;
    const value = values[name].trim();
    return value || emptyAs;
  });
  return { text, unknownFields, emptyFields };
}
