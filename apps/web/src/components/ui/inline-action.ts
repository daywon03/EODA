// Action en TEXTE dans une ligne dense — « Voir », « Télécharger », « Supprimer »,
// « 3 versions précédentes ».
//
// Ces actions faisaient 16 pixels de haut : la hauteur de leur propre texte. Sur la
// tablette que Sandrine emmène en visite, viser trois liens de 16 px alignés dans une
// même ligne relève de l'adresse — et l'un des trois supprime un fichier.
//
// La zone cliquable passe à 36 px sans que la ligne ne grandisse (`py-2 -my-1` : le
// remplissage agrandit la cible, la marge négative reprend la place). Ce n'est pas les
// 44 px des recommandations mobiles, et c'est assumé : trois cibles de 44 px dans une
// ligne d'historique la feraient occuper trois fois sa hauteur, sur un écran qui en
// affiche déjà vingt-neuf. 36 px avec 12 px d'écart est le compromis retenu pour un
// produit utilisé au doigt sur tablette et à la souris sur portable.
//
// Une seule chaîne, partagée : elle était recopiée dans quatre composants, avec trois
// tailles d'icône et deux anneaux de focus différents (D1).
const BASE =
  "inline-flex min-h-9 items-center gap-1 rounded px-1.5 py-2 -my-1 text-xs " +
  "transition-colors cursor-pointer hover:underline " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

export const INLINE_ACTION_CLASS = `${BASE} text-terre focus-visible:ring-terre`;

// Même géométrie, teinte d'alerte : ce qui supprime ne se confond pas avec ce qui
// ouvre.
export const INLINE_ACTION_DESTRUCTIVE_CLASS = `${BASE} text-rouge-imp focus-visible:ring-rouge-imp`;

// Variante sourde, pour un dépliement qui n'est pas une action mais une commande
// d'affichage.
export const INLINE_ACTION_MUTED_CLASS = `${BASE} text-gris-mid hover:text-brun-ancre focus-visible:ring-terre`;
