import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { MAX_PAGE_SIZE, hasMore, nextPageSize } from "@/lib/services/pagination-service";

type Props = {
  /** Chemin de la page courante, sans query string. */
  basePath: string;
  /** Nombre d'éléments réellement affichés. */
  shownCount: number;
  /** Effectif total en base. */
  totalCount: number;
  /** Taille de page en vigueur (déjà bornée par parsePageSize). */
  pageSize: number;
};

// « Voir plus » sans état client : la taille de page voyage dans l'URL, la page
// est un composant serveur, et le plafond dur de `pagination-service` empêche
// `?taille=999999`. Un lien plutôt qu'un bouton — la liste élargie est une URL
// partageable et rechargeable.
export function LoadMoreLink({ basePath, shownCount, totalCount, pageSize }: Props) {
  const remaining = totalCount - shownCount;
  if (remaining <= 0) return null;

  if (!hasMore(shownCount, totalCount, pageSize)) {
    return (
      <p className="text-xs text-gris-mid text-center">
        {shownCount} sur {totalCount} affichés — plafond de {MAX_PAGE_SIZE} atteint. Affinez la
        recherche pour voir le reste.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 pt-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`${basePath}?taille=${nextPageSize(pageSize)}`}>
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
          Voir plus
        </Link>
      </Button>
      <p className="text-xs text-gris-mid">
        {shownCount} sur {totalCount} affichés
      </p>
    </div>
  );
}
