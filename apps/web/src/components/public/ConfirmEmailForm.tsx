"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { confirmEmailAddress, type ConfirmEmailState } from "@/lib/actions/email-verification";
import { CONFIRMATION_MESSAGES } from "@/lib/services/email-verification-service";
import { ResendVerificationForm } from "./ResendVerificationForm";

// Confirmation AU CLIC (tranche 11) : ouvrir le lien n'a aucun effet — un scanner de
// messagerie qui le visite ne consomme pas le jeton. Seul ce bouton confirme.
export function ConfirmEmailForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<ConfirmEmailState, FormData>(confirmEmailAddress, { outcome: null });

  if (state.outcome === "CONFIRMED") {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="flex items-start gap-2">
          <CheckCircle2 className="mt-1 h-5 w-5 flex-shrink-0 text-vert-ok" aria-hidden="true" />
          {CONFIRMATION_MESSAGES.CONFIRMED}
        </p>
        <Link
          href="/login?motif=adresse-confirmee"
          className="inline-flex min-h-14 w-fit items-center rounded-[10px] bg-accent-fill px-6 font-bold text-on-accent"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p>Un clic pour confirmer que cette adresse est bien la vôtre. Votre espace s&apos;ouvre ensuite.</p>
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-14 items-center gap-2 rounded-[10px] bg-accent-fill px-6 text-lg font-bold text-on-accent disabled:opacity-60"
        >
          {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Confirmer mon adresse
        </button>
      </form>
      {state.outcome && (
        <div className="flex flex-col gap-4 border-t border-line pt-5">
          <p role="alert" className="flex items-start gap-2 font-bold text-danger-text">
            <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            {CONFIRMATION_MESSAGES[state.outcome]}
          </p>
          {state.outcome !== "RATE_LIMITED" && <ResendVerificationForm />}
        </div>
      )}
    </div>
  );
}
