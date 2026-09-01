import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ClipboardCheck, ArrowRight } from "lucide-react";
import type { CommercialTier } from "@eoda/database";
import { FORMULE_LABELS } from "./formule-labels";

type Props =
  | { establishmentId: string; mission: null }
  | {
      establishmentId: string;
      mission: { formule: CommercialTier; gratuit: boolean; globalPct: number };
    };

export function MissionSummaryCard({ establishmentId, mission }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-terre" />
          Suivi de mission
        </CardTitle>
        {!mission && <CardDescription>Aucune mission démarrée pour cet établissement.</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {mission && (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{FORMULE_LABELS[mission.formule]}</Badge>
              {mission.gratuit && <Badge variant="not_applicable">Bêta-test gratuit</Badge>}
            </div>
            <ProgressBar value={mission.globalPct} colorClassName="bg-vert-ok" />
            <p className="text-xs text-gris-mid">{mission.globalPct}% d'avancement global</p>
          </>
        )}
        <Button variant={mission ? "outline" : "default"} size="sm" asChild>
          <Link href={`/dashboard/cabinet/etablissements/${establishmentId}/mission`}>
            {mission ? "Voir le suivi" : "Démarrer une mission"}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
