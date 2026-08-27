import Link from "next/link";
import { Building2, Calendar, FileText, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EstablishmentType } from "@eoda/database";
import { StageBadge } from "@/components/crm/StageBadge";
import type { FunnelStage } from "@/lib/services/lifecycle-service";
import { formatDate } from "@/lib/services/date-format-service";

type Props = {
  id: string;
  name: string;
  finessNumber: string | null;
  type: EstablishmentType;
  hasEvaluationTargetDate: Date | null;
  documentCount: number;
  stage: FunnelStage | null;
  beta: boolean;
};

const TYPE_LABELS: Record<EstablishmentType, string> = {
  SAD_AIDE: "SAD Aide",
  SAD_MIXTE: "SAD Mixte",
};

export function EstablishmentCard({
  id,
  name,
  finessNumber,
  type,
  hasEvaluationTargetDate,
  documentCount,
  stage,
  beta,
}: Props) {
  return (
    <Link
      href={`/dashboard/cabinet/etablissements/${id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2"
    >
      <Card className="border-l-4 border-l-terre hover:shadow-eoda-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer h-full">
        <div className="p-5 flex flex-col h-full gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-terre/10 flex-shrink-0">
                <Building2 className="w-4 h-4 text-terre" aria-hidden="true" />
              </span>
              <h3 className="text-base font-semibold text-brun-ancre leading-tight truncate">{name}</h3>
            </div>
            <ChevronRight className="w-4 h-4 text-gris-mid flex-shrink-0 mt-1" aria-hidden="true" />
          </div>

          {finessNumber && <p className="text-xs text-gris-mid pl-[46px]">FINESS {finessNumber}</p>}

          <div className="flex flex-wrap items-center gap-2 pl-[46px]">
            <StageBadge stage={stage} beta={beta} />
            <Badge variant="secondary">{TYPE_LABELS[type]}</Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-gris-mid pl-[46px] mt-auto pt-2 border-t border-gris-light">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              {documentCount} document{documentCount !== 1 ? "s" : ""}
            </span>
            {hasEvaluationTargetDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                {formatDate(
                  new Date(hasEvaluationTargetDate)
                )}
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
