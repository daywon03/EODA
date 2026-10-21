"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import {
  analysisRunPercent,
  describeAnalysisRun,
  type AnalysisRunPhase,
} from "@/lib/services/analysis-progress-service";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";

// Barre et phrase de progression d'une analyse (use-analysis-run). La phrase est lue
// par les lecteurs d'écran (role="status") ; la barre porte le même pourcentage.
export function AnalysisRunStatus({
  phase,
  elapsedMs,
  subject,
  className,
}: {
  phase: AnalysisRunPhase;
  elapsedMs: number;
  subject?: string;
  className?: string;
}) {
  const text = describeAnalysisRun(phase, elapsedMs, subject);
  if (text === null) return null;
  const percent = analysisRunPercent(phase, elapsedMs);
  return (
    <div className={cn("w-full min-w-0 max-w-[320px] space-y-1", className)}>
      {phase !== "done" && (
        <ProgressBar value={percent} label={subject ?? "Analyse"} valueText={text} colorClassName="bg-accent-fill" className="h-1.5" />
      )}
      <p role="status" className="flex items-start gap-1.5 text-sm text-ink">
        {phase === "done" ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ok-text" aria-hidden="true" />
        ) : (
          <Loader2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-spin" aria-hidden="true" />
        )}
        <span className="tabular-nums">{text}</span>
      </p>
    </div>
  );
}
