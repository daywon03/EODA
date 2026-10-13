"use client";

import { useState, useTransition } from "react";
import { handleOptionRequest, type PendingOptionRequest } from "@/lib/actions/option-request";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Inbox, Loader2, X } from "lucide-react";
import { formatStartingPrice } from "@/lib/services/price-format-service";

// File des demandes d'option émises depuis les portails clients (§12.3 : le client
// demande, Sandrine déclenche). Traiter une ligne ne débloque rien côté client —
// c'est un marqueur de file d'attente ; le devis et l'avenant se font dans le
// module devis.
export function OptionRequestQueue({ requests }: { requests: PendingOptionRequest[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(requestId: string, status: "TRAITEE" | "REFUSEE"): void {
    setError(null);
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("status", status);
    startTransition(async () => {
      const result = await handleOptionRequest(formData);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <section className="bg-surface border border-line rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Inbox className="w-5 h-5 text-accent-text flex-shrink-0" aria-hidden="true" />
        <h2 className="text-base font-semibold text-ink">
          Demandes d&apos;options des clients
          {requests.length > 0 && (
            <span className="ml-2 text-sm font-normal text-ink2 tabular-nums">
              ({requests.length} en attente)
            </span>
          )}
        </h2>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-danger-text" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-ink2">Aucune demande en attente.</p>
      ) : (
        <ul className="divide-y divide-line">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{request.establishment.name}</p>
                <p className="text-sm text-ink">{request.option.label}</p>
                <p className="text-xs text-accent-text tabular-nums mt-0.5">
                  {formatStartingPrice(request.option)}
                </p>
                {request.message && (
                  <p className="text-xs text-ink2 mt-1 italic">« {request.message} »</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handle(request.id, "TRAITEE")}
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  Traitée
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => handle(request.id, "REFUSEE")}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  Refuser
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
