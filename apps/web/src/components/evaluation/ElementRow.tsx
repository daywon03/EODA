"use client";

import { useState, useTransition } from "react";
import { rateElement } from "@/lib/actions/evaluation";
import { RatingButtons } from "./RatingButtons";
import { Sparkles } from "lucide-react";
import type { EvaluationElementView } from "@/lib/actions/evaluation";

type Props = { sessionId: string; element: EvaluationElementView };

export function ElementRow({ sessionId, element }: Props) {
  const [comment, setComment] = useState(element.comment ?? "");
  const [, startTransition] = useTransition();

  function saveComment() {
    if (!element.rating) return;
    startTransition(async () => {
      await rateElement(sessionId, element.id, element.rating!, comment || null);
    });
  }

  return (
    <div className="py-3 border-b border-gris-light last:border-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-brun-ancre flex-1">
          {element.reformulatedText ?? element.originalText}
        </p>
        {element.suggestedBySystem && !element.rating && (
          <span
            className="flex items-center gap-1 text-xs text-terre flex-shrink-0"
            title="Documents rattachés conformes — suggestion à confirmer, non appliquée automatiquement"
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            Suggestion : conforme
          </span>
        )}
      </div>
      <RatingButtons
        sessionId={sessionId}
        elementId={element.id}
        currentRating={element.rating}
        allowsRi={element.allowsRi}
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={saveComment}
        disabled={!element.rating}
        rows={2}
        placeholder={element.rating ? "Commentaire / preuve consultée" : "Sélectionnez une cotation pour ajouter un commentaire"}
        className="w-full rounded-md border border-gris-light bg-white px-2 py-1.5 text-xs text-brun-ancre placeholder:text-gris-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-ivoire"
      />
    </div>
  );
}
