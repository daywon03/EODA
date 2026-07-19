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
    <li className="flex items-start gap-2.5 py-1.5">
      <input
        type="checkbox"
        checked={completed}
        onChange={handleChange}
        disabled={locked || isPending}
        className="mt-0.5 accent-terre disabled:cursor-not-allowed"
      />
      <span className={`text-sm flex-1 ${locked ? "text-gris-mid" : "text-brun-ancre"}`}>{label}</span>
      {locked && <Lock className="w-3.5 h-3.5 text-gris-mid flex-shrink-0" aria-hidden="true" />}
      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-gris-mid flex-shrink-0" aria-hidden="true" />}
      {error && <p role="alert" className="text-xs text-rouge-imp">{error}</p>}
    </li>
  );
}
