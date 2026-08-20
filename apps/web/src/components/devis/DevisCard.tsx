import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DevisStatusBadge } from "./DevisStatusBadge";
import type { DevisStatus } from "@eoda/database";
import { formatStartingPrice } from "@/lib/services/price-format-service";

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
    <Link
      href={`/dashboard/cabinet/commercial/devis/${id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2"
    >
      <Card className="border-l-4 border-l-ambre hover:shadow-eoda-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
        <div className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-ambre/15 flex-shrink-0">
              <FileText className="w-4 h-4 text-ambre" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brun-ancre truncate">{number}</p>
              <p className="text-xs text-gris-mid truncate">
                {formuleLabelSnapshot}
                {prospectStructureName ? ` · ${prospectStructureName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-sm font-semibold text-brun-ancre tabular-nums">
              {formatStartingPrice({ priceEuros: totalAmountEuros })}
            </span>
            <DevisStatusBadge status={status} />
            <ChevronRight className="w-4 h-4 text-gris-mid" aria-hidden="true" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
