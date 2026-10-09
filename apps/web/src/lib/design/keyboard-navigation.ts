// Logique clavier des primitives interactives — pure, testée sans navigateur.
//
// Les composants (onglets, fenêtres modales, panneaux) ne font que brancher ces
// fonctions sur leurs événements : c'est ici que se décide où va le focus, donc
// ici que vit le test.

// Onglets (motif WAI-ARIA « Tabs », activation automatique) : flèches gauche/droite
// en boucle, Début / Fin. Renvoie `null` pour une touche qui ne concerne pas la
// liste d'onglets — l'appelant laisse alors l'événement suivre son cours.
export function nextTabIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

// Piège à focus d'une fenêtre modale : Tab depuis le dernier élément revient au
// premier, Maj+Tab depuis le premier va au dernier. Renvoie l'index à focaliser, ou
// `null` quand le navigateur peut faire seul (on reste à l'intérieur).
// `current` vaut -1 quand le focus est hors de la fenêtre (ou sur son conteneur).
export function focusTrapTarget(current: number, count: number, shiftKey: boolean): number | null {
  if (count <= 0) return null;
  if (current < 0) return shiftKey ? count - 1 : 0;
  if (shiftKey && current === 0) return count - 1;
  if (!shiftKey && current === count - 1) return 0;
  return null;
}

// Sélecteur des éléments focalisables d'une fenêtre (piège à focus).
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
