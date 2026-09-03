"use client";

import { useState, useTransition } from "react";
import { rateElement } from "@/lib/actions/evaluation";
import { RatingButtons } from "./RatingButtons";
import { Sparkles } from "lucide-react";
import type { EvaluationElementView } from "@/lib/actions/evaluation";
import { RATING_LABELS } from "@/lib/services/scoring-service";
import type { Rating } from "@eoda/database";
import { Textarea } from "@/components/ui/textarea";

type Props = { sessionId: string | null; element: EvaluationElementView };

export function ElementRow({ sessionId, element }: Props) {
  const [comment, setComment] = useState(element.comment ?? "");
  const [, startTransition] = useTransition();

  const readOnly = sessionId === null;

  function saveComment() {
    if (readOnly || !element.rating) return;
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
      {readOnly ? (
        <ReadOnlyRating rating={element.rating} />
      ) : (
        <RatingButtons
          sessionId={sessionId}
          elementId={element.id}
          currentRating={element.rating}
          allowsRi={element.allowsRi}
        />
      )}
      {/* Le texte en filigrane disparaît dès qu'on écrit : sur une grille de 137
          critères, on ne sait plus à quoi ce champ répond. Libellé masqué à l'œil,
          présent pour les lecteurs d'écran — l'ajouter en clair au-dessus de chaque
          élément ferait 137 fois la même phrase. */}
      <Textarea
        aria-label={`Commentaire et preuve consultée — ${element.originalText.slice(0, 80)}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={saveComment}
        disabled={readOnly || !element.rating}
        rows={2}
        placeholder={
          readOnly
            ? "Session clôturée — commentaire en lecture"
            : element.rating
              ? "Commentaire / preuve consultée"
              : "Sélectionnez une cotation pour ajouter un commentaire"
        }
      />
    </div>
  );
}

// Cotation d'une session clôturée : la valeur, sans le moyen de la changer. Un
// bouton désactivé se lit comme une panne ; une valeur affichée se lit comme un fait.
function ReadOnlyRating({ rating }: { rating: Rating | null }) {
  if (rating === null) {
    return <p className="text-xs text-gris-mid">Non coté lors de cette session</p>;
  }
  return (
    <p className="text-xs text-brun-ancre">
      Cotation retenue :{" "}
      <span className="font-semibold">{RATING_LABELS[rating]}</span>
    </p>
  );
}
