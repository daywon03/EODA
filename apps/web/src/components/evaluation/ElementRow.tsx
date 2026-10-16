"use client";

import { useState, useTransition } from "react";
import type { Rating } from "@eoda/database";
import { rateElement } from "@/lib/actions/evaluation";
import type { EvaluationElementView } from "@/lib/actions/evaluation-chapter";
import { RatingButtons } from "./RatingButtons";
import { RATING_LABELS, RATING_TITLES } from "@/lib/services/scoring-service";
import { describeRatingAuthor } from "@/lib/services/self-assessment-service";
import { RATING_PALETTE } from "@/lib/design/rating-palette";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  sessionId: string | null;
  element: EvaluationElementView;
  isImperatif: boolean;
  ncNoteId: string;
};

const AUTHOR_CLASS = { platform: "font-bold text-accent-text", human: "text-ink2", none: "text-ink2" } as const;

export function ElementRow({ sessionId, element, isImperatif, ncNoteId }: Props) {
  const [comment, setComment] = useState(element.comment ?? "");
  const [, startTransition] = useTransition();
  const text = element.reformulatedText ?? element.originalText;
  const author = describeRatingAuthor(element);
  const rating = element.rating;

  function saveComment() {
    if (sessionId === null || rating === null) return;
    startTransition(async () => {
      await rateElement(sessionId, element.id, rating, comment || null);
    });
  }

  return (
    <li className="space-y-3 py-4 last:pb-0">
      <p className="text-ink">{text}</p>
      <p className={cn("text-sm", AUTHOR_CLASS[author.kind])}>
        {author.text}
        {/* Une suggestion n'est jamais appliquée sans le clic de l'évaluatrice. */}
        {author.kind === "platform" &&
          rating === null &&
          " : 4 — les documents rattachés sont conformes. À confirmer en cotant."}
      </p>
      {sessionId === null ? (
        <ReadOnlyRating rating={rating} />
      ) : (
        <RatingButtons
          sessionId={sessionId}
          elementId={element.id}
          currentRating={rating}
          allowsRi={element.allowsRi}
          isImperatif={isImperatif}
          ncNoteId={ncNoteId}
          groupLabel={`Cotation — ${text.slice(0, 80)}`}
        />
      )}
      {/* Libellé masqué à l'œil, présent pour les lecteurs d'écran : l'écrire en clair
          au-dessus de chaque élément ferait des centaines de fois la même phrase. */}
      <Textarea
        aria-label={`Commentaire et preuve consultée — ${text.slice(0, 80)}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={saveComment}
        disabled={sessionId === null || rating === null}
        rows={2}
        placeholder={
          sessionId === null
            ? "Session clôturée — commentaire en lecture"
            : rating
              ? "Commentaire / preuve consultée"
              : "Cotez d'abord pour ajouter un commentaire"
        }
      />
    </li>
  );
}

// Cotation d'une session clôturée : la valeur, sans le moyen de la changer. Un
// bouton désactivé se lit comme une panne ; une valeur affichée se lit comme un fait.
function ReadOnlyRating({ rating }: { rating: Rating | null }) {
  if (rating === null) return <p className="text-sm text-ink2">Non coté lors de cette session</p>;
  return (
    <p className="flex items-center gap-2 text-sm text-ink">
      Cotation retenue :
      <span
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg border-2 px-2 font-bold",
          RATING_PALETTE[rating].selectedClass
        )}
      >
        <span aria-hidden="true">✓</span>
        {RATING_LABELS[rating]}
      </span>
      {RATING_TITLES[rating]}
    </p>
  );
}
