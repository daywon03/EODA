"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { setStructureConsultant } from "@/lib/actions/structure-consultants";
import { cn } from "@/lib/utils";

// Ouvrir ou fermer la structure à UNE consultante d'EODA (setStructureConsultant). Un
// interrupteur qui dit l'état courant ET ce que le clic produira.
export function StructureConsultantToggle({ userId, name, assigned }: { userId: string; name: string; assigned: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setStructureConsultant(userId, !assigned);
      if (result) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={assigned}
        aria-label={assigned ? `${name} suit votre structure. Lui retirer l'accès` : `${name} ne suit pas votre structure. Lui donner l'accès`}
        onClick={toggle}
        disabled={isPending}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-3.5 py-2 font-bold disabled:opacity-50",
          assigned ? "border-ok-text bg-ok-soft text-ink" : "border-line bg-card text-ink"
        )}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {assigned ? "Suit votre structure" : "Ne suit pas votre structure"}
      </button>
      {error && (
        <span role="alert" className="flex items-center gap-1 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </span>
      )}
    </span>
  );
}
