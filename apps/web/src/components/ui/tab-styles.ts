import { cn } from "@/lib/utils";

// Apparence commune des deux variantes d'onglets — boutons (TabsWithCount, motif
// ARIA « Tabs ») et liens (TabsNav, navigation entre routes). Une seule définition
// pour qu'un onglet ait le même aspect quel que soit son mécanisme (D1).
// `tab-scroller` (globals.css) : défilement sans barre visible, ombre au bord qui
// déborde, filet du bas dessiné sans déborder (plus de barre verticale).
export const TAB_LIST_CLASS = "tab-scroller relative flex gap-1 overflow-x-auto overflow-y-hidden";
// Variante À LA LIGNE (11/11/2026, fiche structure : onze onglets, « Vue d'ensemble » et
// « Réglages » coupés aux bords sans qu'on sache qu'il fallait faire défiler) : tous les
// onglets restent visibles, la barre passe sur deux lignes quand la place manque.
export const TAB_WRAP_CLASS = "relative flex flex-wrap gap-x-1 border-b border-line";

export function tabClassName(isSelected: boolean): string {
  return cn(
    // Contour de focus tracé À L'INTÉRIEUR : la barre coupe ce qui dépasse en hauteur,
    // un contour extérieur y serait rogné (jamais retiré : ui-class-guard).
    "inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-[3px] px-3 text-base focus-visible:outline-offset-[-3px]",
    isSelected ? "border-accent-fill font-bold text-ink" : "border-transparent text-ink2 hover:border-line hover:text-ink"
  );
}

export const TAB_COUNT_CLASS = "min-w-6 rounded-full bg-soft px-2 text-center text-sm font-bold tabular-nums text-ink";
