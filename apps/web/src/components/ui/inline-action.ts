// Action en TEXTE dans une ligne dense — « Voir », « Télécharger », « Supprimer »,
// « 3 versions précédentes ».
//
// Ces actions faisaient 16 pixels de haut : la hauteur de leur propre texte. Sur la
// tablette que Sandrine emmène en visite, viser trois liens de 16 px alignés dans une
// même ligne relève de l'adresse — et l'un des trois supprime un fichier.
//
// La zone cliquable passe à 44 px sans que la ligne ne grandisse autant (`py-2 -my-2` :
// le remplissage agrandit la cible, la marge négative reprend la place). Le compromis
// précédent (36 px) cède devant l'exigence des maquettes v2 (09/10/2026) : cibles
// d'au moins 44 px partout, « même un enfant de 12 ans doit pouvoir s'en servir ».
//
// Une seule chaîne, partagée : elle était recopiée dans quatre composants, avec trois
// tailles d'icône et deux anneaux de focus différents (D1). Le focus est désormais le
// contour global de globals.css.
const BASE =
  "inline-flex min-h-11 items-center gap-1 rounded px-1.5 py-2 -my-2 text-xs " +
  "transition-colors cursor-pointer hover:underline " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";

export const INLINE_ACTION_CLASS = `${BASE} text-terre`;

// Même géométrie, teinte d'alerte : ce qui supprime ne se confond pas avec ce qui
// ouvre.
export const INLINE_ACTION_DESTRUCTIVE_CLASS = `${BASE} text-rouge-imp`;

// Variante sourde, pour un dépliement qui n'est pas une action mais une commande
// d'affichage.
export const INLINE_ACTION_MUTED_CLASS = `${BASE} text-gris-mid hover:text-brun-ancre`;
