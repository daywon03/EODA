import type { DataTableFilterMenu, DataTableSortMenu } from "@/components/ui/data-table";

// Construction des menus de colonne façon Excel (call du 29/10/2026), partagée par
// tous les tableaux : la page dit comment écrire une adresse, ceci fabrique les liens.

export function filterMenuFor(
  values: readonly string[],
  current: string | undefined,
  hrefFor: (value: string | undefined) => string
): DataTableFilterMenu {
  return {
    clearHref: hrefFor(undefined),
    options: values.map((label) => ({ label, href: hrefFor(label), active: label === current })),
  };
}

export function sortMenuFor<S extends string>(
  current: S | null | undefined,
  options: { asc: S; desc: S; ascLabel: string; descLabel: string },
  hrefFor: (sort: S) => string
): DataTableSortMenu {
  return {
    ascHref: hrefFor(options.asc),
    descHref: hrefFor(options.desc),
    ascLabel: options.ascLabel,
    descLabel: options.descLabel,
    active: current === options.asc ? "asc" : current === options.desc ? "desc" : null,
  };
}

// Valeurs distinctes d'une colonne, dans l'ordre français.
export function distinctValues(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base", numeric: true }));
}
