"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { DocumentCategory } from "@eoda/database";
import { acceptDocument } from "@/lib/actions/client-document-acceptance";
import { respondToMissingDocument } from "@/lib/actions/document";
import { canAnswerNotConcerned, type MissingAnswer } from "@/lib/services/missing-answer-service";
import type { ClientDocumentState } from "@/lib/services/client-documents-view-service";
import { Button } from "@/components/ui/button";
import { DepositButton } from "./DepositButton";

// Les gestes d'UNE carte de « Mes documents » : un geste principal, au plus deux
// secondaires (FALC). Chaque geste garde son action serveur, sa garde et sa trace ;
// ce composant ne décide de rien, il propose ce que l'état dérivé permet.
export function ClientDocumentActions({
  establishmentId,
  documentTypeId,
  label,
  category,
  state,
  depositNotice,
}: {
  establishmentId: string;
  documentTypeId: string;
  label: string;
  category: DocumentCategory;
  state: ClientDocumentState;
  depositNotice: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const deposit = { establishmentId, documentTypeId, documentLabel: label, notice: depositNotice };
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string } | null>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result) setError(result.error);
    });
  }

  const answer = (value: MissingAnswer) => run(() => respondToMissingDocument(establishmentId, documentTypeId, value, null));
  const needsDeposit = state === "TO_DEPOSIT" || state === "RENEW";

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2.5">
        {needsDeposit && <DepositButton {...deposit} />}
        {state === "TO_CHECK" && (
          <Button
            type="button"
            size="lg"
            className="h-12 bg-ink-fill px-5 text-lg font-bold text-on-ink hover:bg-ink-fill/90"
            disabled={isPending}
            onClick={() => run(() => acceptDocument(establishmentId, documentTypeId))}
          >
            {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            Je l&apos;accepte
            <span className="sr-only"> : {label}</span>
          </Button>
        )}
        {!needsDeposit && state !== "NOT_CONCERNED" && (
          <DepositButton
            {...deposit}
            secondary
            label={state === "TO_PRODUCE" ? "Je l'ai maintenant : déposer" : "Déposer une autre version"}
          />
        )}
      </div>

      {state === "TO_DEPOSIT" && (
        <div className="flex flex-wrap gap-x-4">
          <button
            type="button"
            disabled={isPending}
            onClick={() => answer("DONT_HAVE")}
            className="min-h-12 text-base font-bold text-accent-text underline"
          >
            Je ne l&apos;ai pas
            <span className="sr-only"> : {label}</span>
          </button>
          {/* Jamais sur les sept documents de la loi 2002-2 (N3). */}
          {canAnswerNotConcerned(category) && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => answer("NOT_CONCERNED")}
              className="min-h-12 text-base text-ink2 underline"
            >
              Ne nous concerne pas
              <span className="sr-only"> : {label}</span>
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 text-base text-danger-text">
          <AlertCircle className="mt-1 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

    </div>
  );
}
