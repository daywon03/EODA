import type { SupportMode } from "@eoda/database";
import type { DiagnosticValidationView } from "@/lib/services/diagnostic-validation-service";

// La mention de relecture du diagnostic, rendue comme sur la maquette : pastille
// pointillée « ? » en autonomie (jamais relu par un humain), pastille pleine quand
// EODA a relu. Le texte vient de review-mention-service, jamais d'ici.
export function DiagnosticValidationBanner({ view, mode }: { view: DiagnosticValidationView; mode: SupportMode }) {
  return (
    <div className="flex flex-col gap-2">
      {mode === "AUTONOMIE" ? (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border-2 border-dashed border-ink2 bg-card px-2.5 py-0.5 font-bold">
          <span aria-hidden="true">?</span> {view.mention}
        </span>
      ) : (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink-fill px-3 py-0.5 font-bold text-on-ink">
          <span aria-hidden="true">{view.mention.startsWith("Relu") ? "✓" : "…"}</span> {view.mention}
        </span>
      )}
      {view.acceptedLabel && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line bg-ok-soft px-3 py-0.5 font-bold text-ok-text">
          <span aria-hidden="true">✓</span> {view.acceptedLabel}
        </span>
      )}
      {view.changedSinceLastGesture && (
        <span className="text-base text-ink2">Le diagnostic a changé depuis le dernier geste : il est à revoir.</span>
      )}
    </div>
  );
}
