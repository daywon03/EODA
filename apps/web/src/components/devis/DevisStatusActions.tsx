"use client";

import { useState, useTransition } from "react";
import { changeDevisStatus } from "@/lib/actions/devis";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Send, CheckCircle2, XCircle } from "lucide-react";
import type { DevisStatus } from "@eoda/database";

const NEXT_STATUSES: Record<DevisStatus, { status: DevisStatus; label: string; icon: typeof Send }[]> = {
  BROUILLON: [
    { status: "ENVOYE", label: "Marquer comme envoyé", icon: Send },
    { status: "REFUSE", label: "Marquer comme refusé", icon: XCircle },
  ],
  ENVOYE: [
    { status: "SIGNE", label: "Marquer comme signé", icon: CheckCircle2 },
    { status: "REFUSE", label: "Marquer comme refusé", icon: XCircle },
  ],
  SIGNE: [],
  REFUSE: [],
};

export function DevisStatusActions({ devisId, status }: { devisId: string; status: DevisStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextStatuses = NEXT_STATUSES[status];

  if (nextStatuses.length === 0) return null;

  function handleClick(nextStatus: DevisStatus) {
    setError(null);
    startTransition(async () => {
      const result = await changeDevisStatus(devisId, nextStatus);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map(({ status: next, label, icon: Icon }) => (
          <Button key={next} type="button" size="sm" variant="outline" disabled={isPending} onClick={() => handleClick(next)}>
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
