"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { validateMatrixForDocumentType } from "@/lib/actions/criterion-matrix";
import type { MatrixGroup } from "@/lib/services/criterion-matrix-service";
import { Button } from "@/components/ui/button";

const CONFIDENCE_LABELS = { HAUTE: "Confiance haute", MOYENNE: "Confiance moyenne", BASSE: "Confiance basse" } as const;

// Une carte par type de document : les critères proposés, cochés d'office s'ils sont
// déjà rattachés OU de confiance haute ; l'admin corrige puis valide. Rien n'est
// écrit avant « Valider » — et le serveur recalcule tout (planMatrixDecision).
export function MatrixTypeForm({ group }: { group: MatrixGroup }) {
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const titleId = `matrix-${group.documentTypeCode}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await validateMatrixForDocumentType(data);
      setMessage(result ? { tone: "error", text: result.error } : { tone: "ok", text: "Rattachements enregistrés." });
    });
  }

  const linkedCount = group.rows.filter((r) => r.linked).length;

  return (
    <form onSubmit={handleSubmit} aria-labelledby={titleId} className="space-y-3 rounded-xl border border-line bg-card p-5">
      <input type="hidden" name="documentTypeCode" value={group.documentTypeCode} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={titleId} className="text-lg font-bold text-ink">
          {group.documentTypeLabel}
        </h3>
        <span className="text-sm text-ink2">
          {linkedCount} rattaché{linkedCount > 1 ? "s" : ""} sur {group.rows.length} proposé
          {group.rows.length > 1 ? "s" : ""}
        </span>
      </div>
      <fieldset className="space-y-1">
        <legend className="sr-only">Critères proposés pour {group.documentTypeLabel}</legend>
        {group.rows.map((row) => (
          <label key={row.criterionCode} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-soft">
            <input
              type="checkbox"
              name="criterionCode"
              value={row.criterionCode}
              defaultChecked={row.linked || row.confidence === "HAUTE"}
              disabled={isPending}
              className="mt-1 h-5 w-5 accent-terre"
            />
            <span className="min-w-0 flex-1">
              <span className="font-bold text-ink">{row.criterionCode}</span>
              <span className="text-ink"> — {row.criterionLabel}</span>
              <span className="block text-sm text-ink2">
                {CONFIDENCE_LABELS[row.confidence]}
                {row.linked && " · déjà rattaché"}
              </span>
              {row.remark && <span className="block text-sm text-ink2">{row.remark}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Valider ce type
        </Button>
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-danger-text" : "text-ok-text"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
