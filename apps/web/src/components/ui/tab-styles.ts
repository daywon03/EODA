import { cn } from "@/lib/utils";

// Apparence commune des deux variantes d'onglets — boutons (TabsWithCount, motif
// ARIA « Tabs ») et liens (TabsNav, navigation entre routes). Une seule définition
// pour qu'un onglet ait le même aspect quel que soit son mécanisme (D1).
export const TAB_LIST_CLASS = "flex gap-1 overflow-x-auto border-b border-line";

export function tabClassName(isSelected: boolean): string {
  return cn(
    "-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-[3px] px-3 text-base",
    isSelected ? "border-accent-fill font-bold text-ink" : "border-transparent text-ink2 hover:border-line hover:text-ink"
  );
}

export const TAB_COUNT_CLASS = "min-w-6 rounded-full bg-soft px-2 text-center text-sm font-bold tabular-nums text-ink";
