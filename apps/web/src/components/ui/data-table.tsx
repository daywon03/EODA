import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DataTableColumn<Row> = {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: "start" | "end";
  // La colonne qui NOMME la ligne (« Livret d'accueil ») : rendue en <th scope="row">,
  // et c'est elle qui porte le lien quand la ligne est cliquable.
  isRowHeader?: boolean;
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
      className={cn("relative overflow-x-auto rounded-xl border border-line bg-card", className)}
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
                {col.header}
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
