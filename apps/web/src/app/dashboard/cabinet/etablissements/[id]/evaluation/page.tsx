import Link from "next/link";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEvaluationChapter, listChapters } from "@/lib/actions/evaluation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChapterOverviewCard } from "@/components/evaluation/ChapterOverviewCard";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export default async function EvaluationOverviewPage({ params }: Props) {
  const { id } = await params;
  const [establishment, chapters] = await Promise.all([getEstablishment(id), listChapters()]);

  const chapterData = await Promise.all(
    chapters.map((c) => getEvaluationChapter(id, c.number))
  );

  const missionRequired = chapterData.some((c) => c.missionRequired);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auto-évaluation HAS"
        subtitle={establishment.name}
        backHref={`/dashboard/cabinet/etablissements/${id}`}
      />

      {missionRequired ? (
        <div className="flex items-start gap-3 bg-ambre/10 border border-ambre/30 rounded-lg px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-ambre flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">Aucune mission démarrée</p>
            <p className="text-gris-mid mb-3">
              L&apos;auto-évaluation nécessite une mission (offre contractuelle) pour déterminer le
              périmètre de critères à vérifier.
            </p>
            <Button size="sm" asChild>
              <Link href={`/dashboard/cabinet/etablissements/${id}/mission`}>Démarrer une mission</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {chapterData.map((data) => (
            <ChapterOverviewCard
              key={data.chapter.number}
              establishmentId={id}
              number={data.chapter.number}
              name={data.chapter.name}
              method={data.chapter.method}
              score={data.chapterScore}
              imperatifsAtRiskCount={data.imperatifsAtRisk.length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
