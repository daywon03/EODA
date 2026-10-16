"use client";

import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import { useActionState, useId } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { resendVerificationLink, type ResendLinkState } from "@/lib/actions/email-verification";
import { LinkDisclosureNotice } from "./LinkDisclosureNotice";

// « Renvoyer le lien » (tranche 11). La réponse est la MÊME que l'adresse ait un
// espace en attente ou non : l'écran ne dit jamais si un compte existe. Avec une
// adresse déjà connue (après l'inscription, après une connexion refusée), le champ
// est caché et pré-rempli ; sinon la personne la saisit.
export function ResendVerificationForm({ knownEmail }: { knownEmail?: string }) {
  const [state, formAction, isPending] = useActionState<ResendLinkState, FormData>(resendVerificationLink, { status: "IDLE" });
  const emailId = useId();

  return (
    <form method="post" onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-3">
      {knownEmail ? (
        <input type="hidden" name="email" value={knownEmail} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="font-bold">
            Votre adresse e-mail
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="h-14 w-full rounded-[10px] border-2 border-line bg-card px-4 text-lg text-ink"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-12 w-fit items-center gap-2 rounded-[10px] border border-ink bg-card px-5 font-bold text-ink hover:bg-soft disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Renvoyer le lien de confirmation
      </button>
      <div aria-live="polite" className="flex flex-col gap-3">
        {state.status === "DONE" && (
          <>
            <p role="status">{state.message}</p>
            <LinkDisclosureNotice disclosure={state.disclosure} />
          </>
        )}
        {state.status === "ERROR" && (
          <p role="alert" className="flex items-start gap-2 font-bold text-danger-text">
            <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
