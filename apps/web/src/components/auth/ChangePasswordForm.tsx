"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/lib/actions/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/security/password-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2 } from "lucide-react";

export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Toutes les sessions ouvertes avant le changement sont désormais refusées,
      // celle-ci comprise : on passe par la route de déconnexion, seule habilitée à
      // supprimer le cookie, plutôt que de laisser l'utilisateur sur une page morte.
      window.location.assign("/deconnexion");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Mot de passe actuel</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Nouveau mot de passe</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          disabled={isPending}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmation">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
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
            Enregistrement…
          </>
        ) : (
          "Changer mon mot de passe"
        )}
      </Button>
    </form>
  );
}
