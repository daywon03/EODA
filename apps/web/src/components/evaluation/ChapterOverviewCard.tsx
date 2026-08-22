import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChevronRight, AlertTriangle } from "lucide-react";

type Props = {
  establishmentId: string;
  number: number;
  name: string;
  method: string;
  score: number | null;
  imperatifsAtRiskCount: number;
};

export function ChapterOverviewCard({ establishmentId, number, name, method, score, imperatifsAtRiskCount }: Props) {
  return (
    <Link
      href={`/dashboard/cabinet/etablissements/${establishmentId}/evaluation/chapitre/${number}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2"
    >
      <Card className="border-l-4 border-l-terre hover:shadow-eoda-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer h-full">
        <div className="p-5 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gris-mid uppercase tracking-wide">Chapitre {number}</p>
              <h3 className="text-base font-semibold text-brun-ancre">{name}</h3>
              <p className="text-xs text-gris-mid mt-0.5">{method}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gris-mid flex-shrink-0" aria-hidden="true" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gris-light mt-1">
            <span className="text-lg font-bold text-brun-ancre tabular-nums">
              {score !== null ? `${score.toFixed(1)}/4` : "Non coté"}
            </span>
            {imperatifsAtRiskCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-rouge-imp font-medium">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                {imperatifsAtRiskCount} à risque
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
