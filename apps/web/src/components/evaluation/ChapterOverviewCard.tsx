import Link from "next/link";
import { structureHref } from "@/lib/design/structure-tabs";
import { chapterLabel } from "@/lib/services/chapter-label-service";

type Props = {
  establishmentId: string;
  number: number;
  name: string;
  method: string;
  score: number | null;
  imperatifsAtRiskCount: number;
  rated: number;
  total: number;
};

// Entrée d'un chapitre : son nom, sa méthode (lue en base), son score et ce qui reste
// à coter. Le lien porte le nom du chapitre ; la carte entière est cliquable.
export function ChapterOverviewCard({
  establishmentId,
  number,
  name,
  method,
  score,
  imperatifsAtRiskCount,
  rated,
  total,
}: Props) {
  return (
    <li className="relative flex flex-col gap-3 rounded-xl border border-line bg-card p-5 hover:border-muted">
      <div className="space-y-1">
        {/* Un seul libellé : « Chapitre 1 » au-dessus d'un titre « Chapitre 1 »
            se lisait deux fois (le référentiel nomme ses chapitres par leur numéro). */}
        <h3 className="text-lg font-bold text-ink">
          <Link
            href={structureHref(establishmentId, `evaluation/chapitre/${number}`)}
            className="after:absolute after:inset-0 hover:underline"
          >
            {chapterLabel({ number, name })}
          </Link>
        </h3>
        {method && (
          <span className="inline-flex w-fit rounded-md border border-line bg-soft px-2.5 py-0.5 text-sm font-bold text-ink">
            {method}
          </span>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3">
        <span className="text-2xl font-bold tabular-nums text-ink">
          {score !== null ? `${score.toFixed(1).replace(".", ",")} / 4` : "Non coté"}
        </span>
        <span className="text-sm tabular-nums text-ink2">
          {rated} / {total} éléments cotés
        </span>
      </div>
      {imperatifsAtRiskCount > 0 && (
        <p className="text-sm font-bold text-danger-text">
          ▲ {imperatifsAtRiskCount} impératif{imperatifsAtRiskCount > 1 ? "s" : ""} sous 4
        </p>
      )}
    </li>
  );
}
