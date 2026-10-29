"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import { setPasswordFromLink, type PasswordSetupResult } from "@/lib/actions/password-setup";
import { MIN_PASSWORD_LENGTH } from "@/lib/security/password-policy";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

// La personne choisit SON mot de passe (audit du 28/10/2026) : personne d'autre ne le
// voit jamais, ni le cabinet ni l'e-mail. Le lien ne sert qu'une fois.
export function PasswordSetupForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, isPending] = useActionState<PasswordSetupResult, FormData>(setPasswordFromLink, { status: "IDLE" });

  if (state.status === "DONE") {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="flex items-start gap-2">
          <CheckCircle2 className="mt-1 h-5 w-5 flex-shrink-0 text-ok-text" aria-hidden="true" />
          Votre mot de passe est enregistré. Vous pouvez vous connecter.
        </p>
        <Link href="/login" className="inline-flex min-h-14 w-fit items-center rounded-[10px] bg-accent-fill px-6 font-bold text-on-accent">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-4">
      <p>
        Choisissez le mot de passe du compte <span className="font-bold">{email}</span>. Au moins {MIN_PASSWORD_LENGTH} caractères : une phrase
        facile à retenir convient très bien.
      </p>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="username" value={email} autoComplete="username" />
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required disabled={isPending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
        <PasswordInput id="confirmation" name="confirmation" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required disabled={isPending} />
      </div>
      {state.status === "ERROR" && (
        <p role="alert" className="flex items-start gap-2 font-bold text-danger-text">
          <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-14 w-fit items-center gap-2 rounded-[10px] bg-accent-fill px-6 text-lg font-bold text-on-accent disabled:opacity-60"
      >
        {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        Enregistrer mon mot de passe
      </button>
    </form>
  );
}
