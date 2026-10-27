"use client";

import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { REFUSAL_REASON_MAX, type AdmissionRefusal } from "@/lib/services/admission-service";
import { TABLET_INPUT, TABLET_PRIMARY, TABLET_SECONDARY } from "../tablet-ui";

// La personne ne souhaite pas signer (HAS 1.7.3 / 1.7.4). Son refus est respecté :
// on ne la fait pas signer ce refus, on le NOTE dans son dossier, avec le motif si
// elle en donne un, et la date à laquelle le contrat lui sera reproposé.
export function AdmissionRefusalPanel({ personName, refusal, onRefusal, error, busy, onConfirm, onBack }: {
  personName: string;
  refusal: AdmissionRefusal;
  onRefusal: (next: AdmissionRefusal) => void;
  error: string | null;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex max-w-[860px] flex-col gap-6">
      <p className="text-[19px]">
        {personName || "La personne"} a le droit de ne pas signer. Son refus est noté dans son dossier, avec ce qui lui a été expliqué. On ne lui fait rien
        signer.
      </p>
      <label className="flex flex-col gap-1.5 text-[19px] font-bold">
        <span>
          Ce qu&apos;elle dit, si elle le souhaite <span className="font-normal text-ink2">(facultatif : elle n&apos;a pas à se justifier)</span>
        </span>
        <textarea
          value={refusal.reason}
          onChange={(e) => onRefusal({ ...refusal, reason: e.target.value })}
          rows={3}
          maxLength={REFUSAL_REASON_MAX}
          className="w-full rounded-xl border-2 border-muted bg-card px-4 py-3 text-[19px] font-normal text-ink"
        />
      </label>
      <label className="flex max-w-[360px] flex-col gap-1.5 text-[19px] font-bold">
        Lui reproposer le contrat le
        <input type="date" value={refusal.reproposeOn} onChange={(e) => onRefusal({ ...refusal, reproposeOn: e.target.value })} className={TABLET_INPUT} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl border-2 border-danger-text px-4 py-3 text-[19px] font-bold text-danger-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={TABLET_SECONDARY} onClick={onBack} disabled={busy}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Revenir au contrat
        </button>
        <button type="button" className={cn(TABLET_PRIMARY, "flex-1")} onClick={onConfirm} disabled={busy} aria-busy={busy}>
          {busy ? "Enregistrement…" : "Enregistrer le refus"}
        </button>
      </div>
    </div>
  );
}
