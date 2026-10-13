"use client";

import { useState, useTransition } from "react";
import { loginAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";
import { ResendVerificationForm } from "@/components/public/ResendVerificationForm";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  // Adresse d'un compte libre-service pas encore confirmée (tranche 11) : connue
  // seulement après un mot de passe JUSTE — on propose de renvoyer le lien.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setUnverifiedEmail(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) setError(result.error);
      if (result?.unverifiedEmail) setUnverifiedEmail(result.unverifiedEmail);
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="prenom.nom@exemple.fr"
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={isPending}
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 border border-rouge-imp/20 rounded-md px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full mt-2" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connexion en cours…
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </form>
      {unverifiedEmail && (
        <div className="mt-5 border-t border-gris-light pt-5 text-base text-ink">
          <ResendVerificationForm knownEmail={unverifiedEmail} />
        </div>
      )}
    </>
  );
}
