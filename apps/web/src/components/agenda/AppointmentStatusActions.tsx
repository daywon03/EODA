"use client";

import { useState, useTransition } from "react";
import type { AppointmentStatus } from "@eoda/database";
import { setAppointmentStatus } from "@/lib/actions/appointment";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Loader2, RotateCcw, X } from "lucide-react";

// Confirmer un créneau proposé, ou l'annuler. Deux gestes seulement, et tous deux
// réversibles : un rendez-vous annulé peut être reproposé, il n'est jamais supprimé.
export function AppointmentStatusActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(next: AppointmentStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setAppointmentStatus(appointmentId, next);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {isPending && <Loader2 className="w-4 h-4 animate-spin text-gris-mid" aria-hidden="true" />}

      {status === "PROPOSE" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run("CONFIRME")}
        >
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          Confirmer
        </Button>
      )}

      {status !== "ANNULE" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => run("ANNULE")}
          aria-label="Annuler ce rendez-vous"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          Annuler
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => run("PROPOSE")}
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reproposer
        </Button>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
