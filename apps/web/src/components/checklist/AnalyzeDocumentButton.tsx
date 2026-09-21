"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { reanalyzeDocument } from "@/lib/actions/document";
import { LLM_MODEL_OPTIONS, DEFAULT_LLM_MODEL_ID } from "@/lib/llm/openrouter-models";
import { Button } from "@/components/ui/button";

// « Il faut un bouton analyser » (Damon, 15/09/2026) — cabinet uniquement, comme le
// sélecteur de modèle au dépôt (DocumentUploadButton). Sert à rattraper une version
// dont l'extraction avait échoué (aucun texte, donc aucune analyse tentée au
// dépôt) sans avoir à la redéposer, et à comparer un autre modèle après coup.
export function AnalyzeDocumentButton({
  documentVersionId,
  hasAnalysis,
}: {
  documentVersionId: string;
  hasAnalysis: boolean;
}) {
  const [modelId, setModelId] = useState(DEFAULT_LLM_MODEL_ID);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await reanalyzeDocument(documentVersionId, modelId);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          disabled={isPending}
          aria-label="Modèle IA pour l'analyse"
          className="rounded-md border border-gris-light bg-surface px-1.5 py-0.5 text-xs text-brun-ancre"
        >
          {LLM_MODEL_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" onClick={handleClick} disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          )}
          {hasAnalysis ? "Réanalyser" : "Analyser"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1 text-xs text-rouge-imp">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
