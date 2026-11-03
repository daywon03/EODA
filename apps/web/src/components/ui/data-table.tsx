import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { Check, ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

// Menu d'une colonne, façon Excel (call du 29/10/2026 : « des flèches sur la colonne,
// comme si on était sur Excel, et je peux filtrer »). Ce sont des LIENS : l'état vit
// dans l'adresse, la page serveur filtre et trie — partageable, et sans JavaScript.
export type DataTableSortMenu = {
  ascHref: string;
  descHref: string;
  ascLabel: string;
  descLabel: string;
  active: "asc" | "desc" | null;
};
export type DataTableFilterMenu = { options: readonly { label: string; href: string; active: boolean }[]; clearHref: string };
export type DataTableColumnMenu = { sort?: DataTableSortMenu; filter?: DataTableFilterMenu };

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: "start" | "end";
  // La colonne qui NOMME la ligne (« Livret d'accueil ») : rendue en <th scope="row">,
  // et c'est elle qui porte le lien quand la ligne est cliquable.
  isRowHeader?: boolean;
  menu?: DataTableColumnMenu;
};

type Props<Row> = {
  // Titre du tableau, lu par le lecteur d'écran. Masqué visuellement par défaut :
  // l'écran porte généralement déjà un titre visible.
  caption: string;
  showCaption?: boolean;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  // Ligne cliquable : un VRAI lien dans la cellule d'en-tête de ligne, étendu à
  // toute la ligne par un pseudo-élément. Le clavier atteint le lien, le lecteur
  // d'écran l'annonce avec le nom de la ligne — un `onClick` sur <tr> ne fait ni
  // l'un ni l'autre. Un bouton placé dans une autre cellule porte `relative z-10`
  // pour rester cliquable au-dessus du lien étendu.
  rowHref?: (row: Row) => string;
  // Geste LOCAL au clic sur la ligne, quand le lien ne doit pas coûter un aller-retour
  // serveur (le panneau d'un document, 20/10/2026). Le lien reste un vrai lien : les
  // modificateurs (Ctrl/⌘, Maj, clic du milieu) et « ouvrir dans un nouvel onglet »
  // gardent leur comportement, et le clavier continue d'atteindre la ligne. Seul le
  // clic gauche simple est intercepté, et l'appelant décide de l'adresse à laisser
  // dans la barre.
  onRowClick?: (row: Row) => void;
  emptyMessage?: string;
  className?: string;
};

// Vrai <table> sémantique, défilement horizontal sur petit écran dans une région
// focalisable (un utilisateur clavier doit pouvoir faire défiler, WCAG 2.1.1).
export function DataTable<Row>({
  caption,
  showCaption = false,
  columns,
  rows,
  getRowKey,
  rowHref,
  onRowClick,
  emptyMessage = "Aucun élément.",
  className,
}: Props<Row>) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      // Un menu de colonne déborde sous l'en-tête : sur grand écran, la région ne
      // rogne plus (le tableau y tient en largeur) ; sur téléphone, elle défile.
      className={cn(
        "relative overflow-x-auto rounded-xl border border-line bg-card",
        columns.some((col) => col.menu) && "lg:overflow-visible",
        className
      )}
    >
      <table className="w-full border-collapse text-left text-base">
        <caption className={showCaption ? "px-4 py-3 text-left font-bold text-ink" : "sr-only"}>{caption}</caption>
        <thead className="bg-soft">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-4 py-3 text-sm font-bold text-ink2",
                  col.align === "end" && "text-right"
                )}
              >
                {col.menu ? <ColumnMenu header={col.header} menu={col.menu} /> : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-ink2">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={getRowKey(row)}
                className={cn("border-t border-line", href && "relative hover:bg-soft")}
              >
                {columns.map((col) => {
                  const content = col.cell(row);
                  const cellClass = cn("px-4 py-3 align-middle text-ink", col.align === "end" && "text-right");
                  if (!col.isRowHeader) {
                    return (
                      <td key={col.id} className={cellClass}>
                        {content}
                      </td>
                    );
                  }
                  return (
                    <th key={col.id} scope="row" className={cn(cellClass, "font-bold")}>
                      {href ? (
                        <Link
                          href={href}
                          className="after:absolute after:inset-0 hover:underline"
                          // Pose `onClick` seulement s'il y a un geste local : sous
                          // `exactOptionalPropertyTypes`, passer `undefined` n'est pas
                          // la même chose que ne pas passer la propriété.
                          {...(onRowClick
                            ? {
                                onClick: (event: MouseEvent<HTMLAnchorElement>) => {
                                  // Clic gauche simple seulement : un nouvel onglet
                                  // reste un nouvel onglet.
                                  if (
                                    event.button !== 0 ||
                                    event.metaKey ||
                                    event.ctrlKey ||
                                    event.shiftKey ||
                                    event.altKey
                                  ) {
                                    return;
                                  }
                                  event.preventDefault();
                                  onRowClick(row);
                                },
                              }
                            : {})}
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </th>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ColumnMenu({ header, menu }: { header: string; menu: DataTableColumnMenu }) {
  const filtered = menu.filter?.options.some((option) => option.active) ?? false;
  const sorted = menu.sort?.active ?? null;
  // La clé change avec l'état : après un clic, le menu se referme (nouveau rendu).
  const stateKey = `${sorted ?? ""}|${menu.filter?.options.find((option) => option.active)?.label ?? ""}`;
  const linkClass = "flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-normal text-ink hover:bg-soft";
  return (
    <details key={stateKey} className="relative inline-block">
      <summary
        className={cn(
          "inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-1 hover:bg-card [&::-webkit-details-marker]:hidden",
          (filtered || sorted) && "text-accent-text"
        )}
        aria-label={`${header} — trier ou filtrer${filtered ? " (filtre actif)" : ""}`}
      >
        {header}
        {filtered ? <Filter className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
      </summary>
      <div className="absolute left-0 top-full z-30 mt-1 w-64 space-y-1 rounded-xl border border-line bg-card p-2 shadow-lg">
        {menu.sort && (
          <>
            <Link href={menu.sort.ascHref} className={linkClass} aria-current={sorted === "asc" ? "true" : undefined}>
              <MenuCheck on={sorted === "asc"} />
              {menu.sort.ascLabel}
            </Link>
            <Link href={menu.sort.descHref} className={linkClass} aria-current={sorted === "desc" ? "true" : undefined}>
              <MenuCheck on={sorted === "desc"} />
              {menu.sort.descLabel}
            </Link>
          </>
        )}
        {menu.filter && (
          <div className={cn(menu.sort && "border-t border-line pt-1")}>
            <Link href={menu.filter.clearHref} className={linkClass} aria-current={!filtered ? "true" : undefined}>
              <MenuCheck on={!filtered} />
              Tout afficher
            </Link>
            {menu.filter.options.map((option) => (
              <Link key={option.label} href={option.href} className={linkClass} aria-current={option.active ? "true" : undefined}>
                <MenuCheck on={option.active} />
                {option.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function MenuCheck({ on }: { on: boolean }) {
  return <Check className={cn("h-4 w-4 flex-shrink-0", on ? "text-accent-text" : "invisible")} aria-hidden="true" />;
}
