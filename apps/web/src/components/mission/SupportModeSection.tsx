"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { SupportMode } from "@eoda/database";
import { setMissionSupportMode } from "@/lib/actions/mission-support-mode";
import { SUPPORT_MODE_LABELS, SUPPORT_MODES } from "@/lib/services/support-mode-service";
import { AUTONOMY_RESERVE } from "@/lib/services/review-mention-service";

// Ce que chaque mode change pour la structure — dit en une phrase au moment du choix,
// parce que c'est la règle de lecture de tout son portail qui bascule.
const MODE_EFFECTS: Record<SupportMode, string> = {
  ACCOMPAGNE: "Rien ne lui parvient sans avoir été relu par EODA.",
  AUTONOMIE: `Elle lit les analyses sans relecture, sous la mention « ${AUTONOMY_RESERVE} »`,
};

// Mode d'accompagnement de la mission (N1). Le choix n'est proposé qu'à
// CABINET_ADMIN ; l'action serveur le refuse à tout autre rôle de toute façon.
export function SupportModeSection({
  missionId,
  supportMode,
  canManage,
}: {
  missionId: string;
  supportMode: SupportMode;
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(mode: SupportMode) {
    if (mode === supportMode) return;
    setError(null);
    startTransition(async () => {
      const result = await setMissionSupportMode(missionId, mode);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-ink">Mode d&apos;accompagnement</h3>
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-ink2" aria-hidden="true" />}
      </div>

      {canManage ? (
        <div role="radiogroup" aria-label="Mode d'accompagnement" className="grid gap-2 sm:grid-cols-2">
          {SUPPORT_MODES.map((mode) => {
            const selected = mode === supportMode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={isPending}
                onClick={() => choose(mode)}
                className={`flex min-h-11 flex-col items-start gap-1 rounded-lg border-2 px-4 py-3 text-left transition-colors disabled:opacity-50 ${
                  selected ? "border-ink bg-soft" : "border-line bg-card hover:border-ink2"
                }`}
              >
                <span className="font-bold text-ink">
                  <span aria-hidden="true">{selected ? "● " : "○ "}</span>
                  {SUPPORT_MODE_LABELS[mode]}
                </span>
                <span className="text-sm text-ink2">{MODE_EFFECTS[mode]}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-ink">
          <span className="font-bold">{SUPPORT_MODE_LABELS[supportMode]}.</span> {MODE_EFFECTS[supportMode]}
        </p>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger-text">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
