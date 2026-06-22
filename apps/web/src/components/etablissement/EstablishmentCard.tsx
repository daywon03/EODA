import Link from "next/link";
import { Building2, Calendar, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EstablishmentType } from "@eoda/database";

type Props = {
  id: string;
  name: string;
  finessNumber: string | null;
  type: EstablishmentType;
  hasEvaluationTargetDate: Date | null;
  documentCount: number;
};

const TYPE_LABELS: Record<EstablishmentType, string> = {
  SAD_AIDE: "SAD Aide",
  SAD_MIXTE: "SAD Mixte",
};

export function EstablishmentCard({ id, name, finessNumber, type, hasEvaluationTargetDate, documentCount }: Props) {
  return (
    <Link href={`/dashboard/cabinet/etablissements/${id}`}>
      <Card className="hover:border-terre hover:shadow-md transition-all cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-terre flex-shrink-0 mt-0.5" />
              <CardTitle className="text-base leading-tight">{name}</CardTitle>
            </div>
            <Badge variant="secondary">{TYPE_LABELS[type]}</Badge>
          </div>
          {finessNumber && (
            <p className="text-xs text-gris-mid pl-7">FINESS {finessNumber}</p>
          )}
        </CardHeader>
        <CardContent className="flex items-center gap-4 text-xs text-gris-mid">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {documentCount} document{documentCount !== 1 ? "s" : ""}
          </span>
          {hasEvaluationTargetDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Éval. HAS :{" "}
              {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
                new Date(hasEvaluationTargetDate)
              )}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
