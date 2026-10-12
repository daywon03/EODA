// Libellé d'un chapitre du référentiel, UN SEUL endroit pour tous les écrans.
//
// Le référentiel chargé en base nomme ses chapitres « Chapitre N » (seed
// `seed-has-referential.ts`) : composer « Chapitre {n} — {nom} » affichait donc
// « Chapitre 1 — Chapitre 1 ». On corrige l'affichage, pas la donnée : si un nom
// réel est un jour chargé (« La personne »), il s'affiche.

type Chapter = { number: number; name: string };

function normalise(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

// Le nom du chapitre s'il dit autre chose que son numéro, sinon null.
export function chapterDistinctName(chapter: Chapter): string | null {
  const name = chapter.name.trim().replace(/\s+/g, " ");
  if (name === "") return null;
  if (normalise(name) === `chapitre ${chapter.number}`) return null;
  return name;
}

export function chapterLabel(chapter: Chapter): string {
  const name = chapterDistinctName(chapter);
  return name ? `Chapitre ${chapter.number} — ${name}` : `Chapitre ${chapter.number}`;
}
