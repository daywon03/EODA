import Link from "next/link";
import { Users, Phone, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProspectStatusBadge } from "./ProspectStatusBadge";
import type { ProspectStatus, ProspectType } from "@eoda/database";
import { formatEuros } from "@/lib/services/price-format-service";

type Props = {
  id: string;
  structureName: string;
  structureType: ProspectType;
  status: ProspectStatus;
  contactName: string | null;
  estimatedAmountEuros: number | null;
  devisCount: number;
};

const TYPE_LABELS: Record<ProspectType, string> = {
  ASSOCIATION: "Association",
  PRIVE: "Privé",
  PUBLIC: "Public",
};

export function ProspectCard({
  id,
  structureName,
  structureType,
  status,
  contactName,
  estimatedAmountEuros,
  devisCount,
}: Props) {
  return (
    <Link
      href={`/dashboard/cabinet/commercial/prospects/${id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2"
    >
      <Card className="border-l-4 border-l-terre hover:shadow-eoda-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer h-full">
        <div className="p-4 flex flex-col h-full gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-brun-ancre leading-tight truncate">{structureName}</h3>
            <ChevronRight className="w-4 h-4 text-gris-mid flex-shrink-0 mt-0.5" aria-hidden="true" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{TYPE_LABELS[structureType]}</Badge>
            <ProspectStatusBadge status={status} />
          </div>

          {contactName && (
            <p className="flex items-center gap-1 text-xs text-gris-mid">
              <Users className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              {contactName}
            </p>
          )}

          <div className="flex items-center gap-3 text-xs text-gris-mid mt-auto pt-2 border-t border-gris-light">
            {estimatedAmountEuros != null && (
              <span className="font-medium text-brun-ancre">
                {formatEuros(estimatedAmountEuros)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              {devisCount} devis
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
