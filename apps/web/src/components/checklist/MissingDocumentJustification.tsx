"use client";

import { useState, useTransition } from "react";
import { respondToMissingDocument, updateMissingJustification } from "@/lib/actions/document";
import { Loader2, AlertCircle } from "lucide-react";
import type { DocumentStatus } from "@eoda/database";

type Props = {
  establishmentId: string;
  documentTypeId: string;
  status: DocumentStatus;
  missingJustification: string | null;
  // Une version existe déjà : le commentaire reste corrigeable, mais la question
  // « ce document vous concerne-t-il ? » n'a plus de sens et ne doit surtout plus
  // pouvoir rebasculer un document déposé en NOT_APPLICABLE.
  hasVersion?: boolean;
};

// "Ce document vous concerne-t-il ?" — Oui/Non + commentaire libre, utilisable
// comme élément de preuve pour la cotation HAS (Module 3). Le commentaire reste
// éditable APRÈS dépôt : il devenait définitif au premier fichier, une faute de
// saisie restait affichée pour toujours.
export function MissingDocumentJustification({
  establishmentId,
  documentTypeId,
  status,
  missingJustification,
  hasVersion = false,
}: Props) {
  const [comment, setComment] = useState(missingJustification ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAnswer(applies: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondToMissingDocument(establishmentId, documentTypeId, applies, comment);
      if (result && "error" in result) setError(result.error);
    });
  }

  // Deux actions distinctes, jamais fusionnées : celle-ci ne touche QUE le
  // commentaire, sans jamais recalculer le statut d'un document déjà déposé.
  function handleCommentOnly() {
    if (comment.trim() === (missingJustification ?? "").trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await updateMissingJustification(establishmentId, documentTypeId, comment);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="mt-2 space-y-1.5 bg-ivoire rounded-md p-2.5">
      {hasVersion ? (
        <p className="text-xs text-gris-mid">
          Commentaire{isPending && <Loader2 className="inline w-3 h-3 ml-1 animate-spin" aria-hidden="true" />}
        </p>
      ) : (
      <div className="flex items-center gap-2 text-xs text-gris-mid">
        <span>Ce document vous concerne-t-il ?</span>
        <button
          type="button"
          onClick={() => handleAnswer(true)}
          disabled={isPending}
          className={`px-2 py-0.5 rounded-full border text-xs cursor-pointer disabled:cursor-not-allowed ${
            status === "MISSING" ? "border-terre bg-terre/10 text-terre" : "border-gris-light text-gris-mid"
          }`}
        >
          Oui
        </button>
        <button
          type="button"
          onClick={() => handleAnswer(false)}
          disabled={isPending}
          className={`px-2 py-0.5 rounded-full border text-xs cursor-pointer disabled:cursor-not-allowed ${
            status === "NOT_APPLICABLE" ? "border-terre bg-terre/10 text-terre" : "border-gris-light text-gris-mid"
          }`}
        >
          Non
        </button>
        {isPending && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
      </div>
      )}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={() => (hasVersion ? handleCommentOnly() : handleAnswer(status !== "NOT_APPLICABLE"))}
        disabled={isPending}
        rows={2}
        placeholder={
          hasVersion
            ? "Commentaire libre sur ce document (corrigeable à tout moment)"
            : "Commentaire libre (ex : pourquoi ce document ne s'applique pas, où il en est...)"
        }
        className="w-full rounded-md border border-gris-light bg-white px-2 py-1.5 text-xs text-brun-ancre placeholder:text-gris-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre disabled:cursor-not-allowed disabled:opacity-50"
      />
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
