"use client";

import { useState, useTransition } from "react";
import { toggleChecklistItem } from "@/lib/actions/mission";
import { Loader2, Lock } from "lucide-react";

type Props = {
  missionId: string;
  code: string;
  label: string;
  completed: boolean;
  locked?: boolean;
};

export function MissionChecklistItemRow({ missionId, code, label, completed, locked = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.checked;
    setError(null);
    startTransition(async () => {
      const result = await toggleChecklistItem(missionId, code, next);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <li className="flex flex-col py-0.5">
      {/* Vrai <label> : la case porte son libellé pour un lecteur d'écran, et toute
          la ligne (≥ 44 px) est une cible — cliquer le texte coche aussi. */}
      <label
        className={`flex min-h-11 items-center gap-2.5 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          checked={completed}
          onChange={handleChange}
          disabled={locked || isPending}
          className="h-4 w-4 flex-shrink-0 accent-terre disabled:cursor-not-allowed"
        />
        <span className={`text-sm flex-1 ${locked ? "text-ink2" : "text-brun-ancre"}`}>
          {label}
          {locked && <span className="sr-only"> (hors du périmètre de l&apos;offre)</span>}
        </span>
        {locked && <Lock className="w-3.5 h-3.5 text-ink2 flex-shrink-0" aria-hidden="true" />}
        {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink2 flex-shrink-0" aria-hidden="true" />}
      </label>
      {error && <p role="alert" className="text-sm text-rouge-imp">{error}</p>}
    </li>
  );
}
