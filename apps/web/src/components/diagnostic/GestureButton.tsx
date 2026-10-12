"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Un geste unique (« J'accepte ce diagnostic », « Marquer le diagnostic relu ») : une
// action serveur déjà liée à sa cible, un libellé, l'erreur dite en toutes lettres.
// Le composant ne décide de rien — la garde et la règle sont côté serveur.
export function GestureButton({
  action,
  label,
  className,
  large = false,
}: {
  action: () => Promise<{ error: string } | null>;
  label: string;
  className?: string;
  large?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        size="lg"
        disabled={isPending}
        className={cn(
          "bg-ink-fill font-bold text-on-ink hover:bg-ink-fill/90",
          large ? "h-14 px-6 text-lg" : "h-12 px-5 text-base",
          className
        )}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result) setError(result.error);
          });
        }}
      >
        {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-base font-bold text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
