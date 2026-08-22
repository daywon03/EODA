"use client";

import { useState, useTransition } from "react";
import { updateProspectStatus } from "@/lib/actions/prospect";
import { Select } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { PROSPECT_STATUS_LABELS } from "./ProspectStatusBadge";
import type { ProspectStatus } from "@eoda/database";

const STATUSES: ProspectStatus[] = ["NOUVEAU", "RDV", "DEVIS_ENVOYE", "NEGOCIATION", "SIGNE", "PERDU"];

export function ProspectStatusSelect({ prospectId, status }: { prospectId: string; status: ProspectStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as ProspectStatus;
    setError(null);
    startTransition(async () => {
      const result = await updateProspectStatus(prospectId, next);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select defaultValue={status} onChange={handleChange} disabled={isPending} className="w-auto">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROSPECT_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {isPending && <Loader2 className="w-4 h-4 animate-spin text-gris-mid" aria-hidden="true" />}
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
