import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DevisStatusBadge } from "./DevisStatusBadge";
import type { DevisStatus } from "@eoda/database";
import { formatStartingPrice } from "@/lib/services/price-format-service";
import { DeleteDevisButton } from "./DeleteDevisButton";

type Props = {
  id: string;
  number: string;
  status: DevisStatus;
  formuleLabelSnapshot: string;
  totalAmountEuros: number;
  prospectStructureName?: string;
};

export function DevisCard({ id, number, status, formuleLabelSnapshot, totalAmountEuros, prospectStructureName }: Props) {
  return (
    // Lien en superposition plutôt que carte enveloppée dans un <a> : la carte porte
    // désormais une action, et un bouton dans un lien est invalide autant
    // qu'inutilisable — le clic partirait sur le devis.
    <Card className="relative border-l-4 border-l-ambre transition-all duration-150 hover:-translate-y-0.5 hover:shadow-eoda-md focus-within:ring-2 focus-within:ring-terre focus-within:ring-offset-2">
      <Link
        href={`/dashboard/cabinet/commercial/devis/${id}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none"
      >
        <span className="sr-only">Ouvrir le devis {number}</span>
      </Link>

      <div className="pointer-events-none flex items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ambre/15">
            <FileText className="h-4 w-4 text-ambre" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brun-ancre">{number}</p>
            <p className="truncate text-xs text-gris-mid">
              {formuleLabelSnapshot}
              {prospectStructureName ? ` · ${prospectStructureName}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-brun-ancre">
            {formatStartingPrice({ priceEuros: totalAmountEuros })}
          </span>
          <DevisStatusBadge status={status} />
          {/* Poubelle réservée aux BROUILLONS, comme sur la fiche du devis : un devis
              émis porte un numéro de la série annuelle, il ne se supprime pas, il
              s'annule. L'action serveur le revérifie — cette condition n'est qu'un
              affichage. */}
          {status === "BROUILLON" && (
            <span className="pointer-events-auto relative z-10">
              <DeleteDevisButton devisId={id} number={number} compact />
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-gris-mid" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}
