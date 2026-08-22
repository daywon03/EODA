import { AlertTriangle } from "lucide-react";
import { scoreLabel } from "@/lib/services/scoring-service";
import type { EvaluationChapterData } from "@/lib/actions/evaluation";

type Props = { chapterScore: number | null; imperatifsAtRisk: EvaluationChapterData["imperatifsAtRisk"] };

export function ChapterResultsSummary({ chapterScore, imperatifsAtRisk }: Props) {
  return (
    <div className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-brun-ancre">Score du chapitre</span>
        <span className="text-2xl font-bold text-brun-ancre tabular-nums">
          {chapterScore !== null ? `${chapterScore.toFixed(1)}/4` : "—"}
        </span>
      </div>
      {chapterScore !== null && <p className="text-xs text-gris-mid">{scoreLabel(chapterScore)}</p>}

      {imperatifsAtRisk.length > 0 && (
        <div className="border-t border-gris-light pt-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rouge-imp">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            {imperatifsAtRisk.length} critère{imperatifsAtRisk.length > 1 ? "s" : ""} impératif
            {imperatifsAtRisk.length > 1 ? "s" : ""} à traiter
          </p>
          <ul className="space-y-1">
            {imperatifsAtRisk.map((c) => (
              <li key={c.code} className="text-xs text-gris-mid">
                <span className="font-medium text-brun-ancre">{c.code}</span> — {c.label} (
                {c.score !== null ? c.score.toFixed(1) : "—"}/4)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
