"use client";

import { useState, useTransition } from "react";
import { Check, X, Sparkles, Loader2 } from "lucide-react";
import {
  confirmTemplateCriterionSuggestion,
  rejectTemplateCriterionSuggestion,
} from "@/lib/actions/template-criterion-suggestion";
import type { TemplateDetail } from "@/lib/actions/template-library";
import { Button } from "@/components/ui/button";

// Pendant de CriterionSuggestionsList (checklist client) pour la bibliothèque de
// modèles : « un gabarit peut répondre à plusieurs critères — parfois jusqu'à dix
// — l'IA doit les détecter tous » (persona du 20/09/2026). Chaque ligne reste une
// hypothèse tant que le cabinet ne l'a pas tranchée.
export function TemplateCriterionSuggestionsList({
  templateId,
  suggestions,
}: {
  templateId: string;
  suggestions: TemplateDetail["criterionSuggestions"];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = suggestions.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  function decide(id: string, action: "confirm" | "reject") {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const result =
        action === "confirm"
          ? await confirmTemplateCriterionSuggestion(templateId, id)
          : await rejectTemplateCriterionSuggestion(templateId, id);
      setPendingId(null);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      // Optimiste sur l'affichage local : getTemplate ne rendra plus la ligne au
      // prochain chargement, la revalidation server-side a déjà la vérité.
      setDismissed((prev) => new Set(prev).add(id));
    });
  }

  return (
    <div className="rounded-lg border border-terre/30 bg-terre/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-brun-ancre">
        <Sparkles className="h-3.5 w-3.5 text-terre" aria-hidden="true" />
        Critères HAS supplémentaires détectés — à confirmer
      </p>
      <ul className="mt-2 space-y-2">
        {visible.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-brun-ancre">
                {s.criterionCode} — {s.criterionLabel}
              </p>
              <p className="mt-0.5 text-gris-mid">{s.justification}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingId === s.id}
                onClick={() => decide(s.id, "confirm")}
                aria-label={`Confirmer le critère ${s.criterionCode}`}
              >
                {pendingId === s.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-vert-ok" aria-hidden="true" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pendingId === s.id}
                onClick={() => decide(s.id, "reject")}
                aria-label={`Rejeter le critère ${s.criterionCode}`}
              >
                <X className="h-3.5 w-3.5 text-rouge-imp" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-rouge-imp">{error}</p>}
    </div>
  );
}
