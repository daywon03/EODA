"use client";

import { useState, useTransition } from "react";
import { Check, X, Sparkles, Loader2 } from "lucide-react";
import {
  confirmAllCriterionSuggestions,
  confirmCriterionSuggestion,
  rejectCriterionSuggestion,
} from "@/lib/actions/criterion-suggestion";
import type { CriterionSuggestionItem } from "@/lib/actions/checklist";
import { Button } from "@/components/ui/button";

// Critères HAS supplémentaires détectés par l'IA (persona « adjoint IA qualité
// HAS », 20/09/2026) : « un même document peut répondre à plusieurs critères —
// parfois jusqu'à dix — l'IA doit les détecter tous, jamais se limiter à un
// seul ». Chaque ligne est une hypothèse à trancher, jamais un fait déjà acquis
// — rien ne change ailleurs (aucun rattachement, aucune couverture) avant que
// la consultante confirme ou rejette.
export function CriterionSuggestionsList({
  establishmentId,
  suggestions,
}: {
  establishmentId: string;
  suggestions: CriterionSuggestionItem[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isConfirmingAll, setIsConfirmingAll] = useState(false);
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
          ? await confirmCriterionSuggestion(establishmentId, id)
          : await rejectCriterionSuggestion(establishmentId, id);
      setPendingId(null);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      // Optimiste sur l'affichage local : le serveur a déjà la vérité, revenir
      // sur cette fiche la relira depuis buildChecklist au prochain chargement.
      setDismissed((prev) => new Set(prev).add(id));
    });
  }

  function confirmAll() {
    setError(null);
    setIsConfirmingAll(true);
    startTransition(async () => {
      const result = await confirmAllCriterionSuggestions(
        establishmentId,
        visible.map((s) => s.id)
      );
      setIsConfirmingAll(false);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setDismissed((prev) => {
        const next = new Set(prev);
        visible.forEach((s) => next.add(s.id));
        return next;
      });
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-terre/30 bg-terre/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brun-ancre">
          <Sparkles className="h-3.5 w-3.5 text-terre" aria-hidden="true" />
          Critères HAS supplémentaires détectés — à confirmer
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isConfirmingAll || pendingId !== null}
          onClick={confirmAll}
          className="flex-shrink-0 text-xs"
        >
          {isConfirmingAll ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-3.5 w-3.5 text-vert-ok" aria-hidden="true" />
          )}
          Tout accepter ({visible.length})
        </Button>
      </div>
      <ul className="mt-2 space-y-2">
        {visible.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-brun-ancre">
                {s.criterionIsImperative && (
                  <span
                    className="mr-1 rounded bg-terre px-1 py-0.5 text-[10px] font-semibold uppercase text-white"
                    title="Critère impératif HAS — obligatoire pour l'évaluation"
                  >
                    Impératif
                  </span>
                )}
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
