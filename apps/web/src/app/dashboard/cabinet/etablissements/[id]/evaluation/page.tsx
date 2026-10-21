import Link from "next/link";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEvaluationChapter, listChapters } from "@/lib/actions/evaluation-chapter";
import {
  countRatedElements,
  describeAssessmentScope,
  describeAverageMeasure,
  describeChapterRatedMeasure,
} from "@/lib/services/self-assessment-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { ChapterOverviewCard } from "@/components/evaluation/ChapterOverviewCard";
import { ImportSynaeGridForm } from "@/components/evaluation/ImportSynaeGridForm";
import { MeasureCard } from "@/components/ui/measure-card";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { Download, GitCompareArrows } from "lucide-react";

export const metadata = { title: "Auto-évaluation" };

type Props = { params: Promise<{ id: string }> };

export default async function EvaluationOverviewPage({ params }: Props) {
  const { id } = await params;
  const [establishment, chapters] = await Promise.all([getEstablishment(id), listChapters()]);
  const chapterData = await Promise.all(chapters.map((c) => getEvaluationChapter(id, c.number)));

  if (chapterData.some((c) => c.missionRequired)) {
    return (
      <div className="max-w-3xl space-y-6">
        <h2 className="text-2xl font-bold text-ink">Auto-évaluation</h2>
        <Callout tone="warning" title="Aucune mission démarrée">
          <p className="mb-3">
            L&apos;auto-évaluation nécessite une mission (offre contractuelle) pour déterminer le
            périmètre de critères à vérifier.
          </p>
          <Button size="sm" asChild>
            <Link href={structureHref(id, "mission")}>Démarrer une mission</Link>
          </Button>
        </Callout>
      </div>
    );
  }

  const chapterRows = chapterData.map((data) => {
    const criteria = data.themes.flatMap((t) => t.objectives.flatMap((o) => o.criteria));
    return { data, criteria, count: countRatedElements(criteria) };
  });
  const scope = describeAssessmentScope({
    criteriaCount: chapterRows.reduce((n, c) => n + c.criteria.length, 0),
    imperativesOnly: chapterData.some((c) => c.imperativesOnly),
    establishmentType: establishment.type,
  });

  return (
    <div className="space-y-8">
      <section aria-labelledby="ae-synthese" className="space-y-3">
        <h2 id="ae-synthese" className="text-2xl font-bold text-ink">
          Auto-évaluation
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MeasureCard {...describeAverageMeasure(chapterData.map((c) => c.chapterScore))} />
          {chapterRows.map(({ data, count }) => (
            <MeasureCard key={data.chapter.number} {...describeChapterRatedMeasure(data.chapter, count)} />
          ))}
        </div>
        {/* Périmètre exact, lu en base — jamais « 141 », jamais le « 157 » commercial. */}
        <p className="text-sm text-ink2">{scope}. Outil de préparation, pas une évaluation HAS officielle.</p>
      </section>

      <section aria-labelledby="ae-chapitres" className="space-y-3">
        <h2 id="ae-chapitres" className="text-xl font-bold text-ink">
          Coter par chapitre
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {chapterRows.map(({ data, count }) => (
            <ChapterOverviewCard
              key={data.chapter.number}
              establishmentId={id}
              number={data.chapter.number}
              name={data.chapter.name}
              method={data.chapter.method}
              score={data.chapterScore}
              imperatifsAtRiskCount={data.imperatifsAtRisk.length}
              rated={count.rated}
              total={count.total}
            />
          ))}
        </ul>
      </section>

      {/* Seconde auto-évaluation « comparable à la première » (§12.6) et export des
          cotations. Le format d'import réel de Synaé n'est toujours pas spécifié —
          l'écran le DIT plutôt que de laisser croire à une compatibilité. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
          <h3 className="font-bold text-ink">Importer une grille Synaé cotée</h3>
          <p className="text-ink2">
            Le chapitre se lit dans la grille ; les cotations complètent la session ouverte. Ce qui est déjà
            coté à l&apos;écran est conservé, et les règles HAS (RI, NC sur impératif) s&apos;appliquent.
          </p>
          <ImportSynaeGridForm establishmentId={id} />
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
          <h3 className="font-bold text-ink">Comparer avec la session précédente</h3>
          <p className="text-ink2">Progressions, reculs et impératifs repassés sous 4, critère par critère.</p>
          <Button variant="outline" className="mt-auto w-fit" asChild>
            <Link href={structureHref(id, "evaluation/comparaison")}>
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              Voir la comparaison
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5">
          <h3 className="font-bold text-ink">Exporter les cotations</h3>
          <p className="text-ink2">
            Tableur complet — chapitre, critère, élément, cotation, commentaire. Format générique : le
            gabarit d&apos;import Synaé n&apos;est pas encore connu.
          </p>
          <Button variant="outline" className="mt-auto w-fit" asChild>
            <a href={`/api/export/cotations/${id}`}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Télécharger (CSV)
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
