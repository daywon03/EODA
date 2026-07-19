"use client";

import { useState, useTransition } from "react";
import { respondToMissingDocument } from "@/lib/actions/document";
import { Loader2, AlertCircle } from "lucide-react";
import type { DocumentStatus } from "@eoda/database";

type Props = {
  establishmentId: string;
  documentTypeId: string;
  status: DocumentStatus;
  missingJustification: string | null;
};

// "Ce document vous concerne-t-il ?" — Oui/Non + commentaire libre, utilisable
// comme élément de preuve pour la cotation HAS (Module 3). N'apparaît que tant
// qu'aucun fichier n'a été déposé (MISSING/NOT_APPLICABLE).
export function MissingDocumentJustification({
  establishmentId,
  documentTypeId,
  status,
  missingJustification,
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

  return (
    <div className="mt-2 space-y-1.5 bg-ivoire rounded-md p-2.5">
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
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={() => handleAnswer(status === "NOT_APPLICABLE" ? false : true)}
        disabled={isPending}
        rows={2}
        placeholder="Commentaire libre (ex : pourquoi ce document ne s'applique pas, où il en est...)"
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
