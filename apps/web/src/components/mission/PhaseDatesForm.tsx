"use client";

import { useState, useTransition } from "react";
import { updatePhaseDates } from "@/lib/actions/mission";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import type { MissionChecklistScope } from "@eoda/database";

type Props = {
  missionId: string;
  phase: Exclude<MissionChecklistScope, "DIAGNOSTIC">;
  startDate: Date | null;
  endDate: Date | null;
  disabled?: boolean;
};

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function PhaseDatesForm({ missionId, phase, startDate, endDate, disabled = false }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [start, setStart] = useState(toDateInputValue(startDate));
  const [end, setEnd] = useState(toDateInputValue(endDate));

  function commit(nextStart: string, nextEnd: string) {
    setError(null);
    startTransition(async () => {
      const result = await updatePhaseDates(missionId, phase, nextStart || null, nextEnd || null);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`${phase}-start`} className="text-xs">Début</Label>
        <Input
          id={`${phase}-start`}
          type="date"
          value={start}
          disabled={disabled || isPending}
          onChange={(e) => {
            setStart(e.target.value);
            commit(e.target.value, end);
          }}
          className="w-40 h-9 text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${phase}-end`} className="text-xs">Fin</Label>
        <Input
          id={`${phase}-end`}
          type="date"
          value={end}
          disabled={disabled || isPending}
          onChange={(e) => {
            setEnd(e.target.value);
            commit(start, e.target.value);
          }}
          className="w-40 h-9 text-sm"
        />
      </div>
      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-gris-mid" aria-hidden="true" />}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
