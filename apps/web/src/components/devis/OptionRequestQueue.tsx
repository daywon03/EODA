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
    <section className="bg-white border border-gris-light rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <Inbox className="w-5 h-5 text-terre flex-shrink-0" aria-hidden="true" />
        <h2 className="text-base font-semibold text-brun-ancre">
          Demandes d&apos;options des clients
          {requests.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gris-mid tabular-nums">
              ({requests.length} en attente)
            </span>
          )}
        </h2>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-rouge-imp" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-gris-mid">Aucune demande en attente.</p>
      ) : (
        <ul className="divide-y divide-gris-light">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brun-ancre">{request.establishment.name}</p>
                <p className="text-sm text-brun-ancre">{request.option.label}</p>
                <p className="text-xs text-terre tabular-nums mt-0.5">
                  {formatStartingPrice(request.option)}
                </p>
                {request.message && (
                  <p className="text-xs text-gris-mid mt-1 italic">« {request.message} »</p>
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
