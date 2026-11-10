"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageSquarePlus } from "lucide-react";
import {
  addCriterionGuidelines,
  listCriterionGuidelines,
  setCriterionGuidelineAiUse,
  type CriterionGuidelineItem,
} from "@/lib/actions/document";
import { MAX_GUIDELINE_LENGTH } from "@/lib/services/criterion-guideline-service";
import { formatDate } from "@/lib/services/date-format-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnalyzeDocumentButton } from "@/components/checklist/AnalyzeDocumentButton";

// ─────────────────────────────────────────────────────────────────────────────
// CONSIGNES POUR L'IA SUR UN CRITÈRE — sous le critère, dans l'onglet « Critères HAS »
// de la fiche document (10/11/2026, décision de Damon : « Ajouter une guideline sur
// des critères HAS » quitte l'onglet Analyse, un seul endroit pour les critères).
//
// Même fait qu'avant, mêmes actions (CriterionGuideline, append-only) : une consigne
// est relue à chaque analyse d'un document rattaché à ce critère, pour toutes les
// structures, tant qu'elle est « prise en compte par l'IA ». Posée sous un critère
// RATTACHÉ au type, elle est toujours lue pour ce document : l'avertissement « pas lu
// pour ce document » de l'ancien formulaire n'a plus lieu d'être.
//
// Chargement paresseux : les consignes existantes ne sont lues qu'à l'ouverture.
// ─────────────────────────────────────────────────────────────────────────────

export function CriterionGuidelineNotes({
  criterionId,
  criterionCode,
  documentVersionId,
  canWrite,
}: {
  criterionId: string;
  criterionCode: string;
  // Version courante du document, pour proposer de relancer l'analyse après l'ajout.
  documentVersionId: string | null;
  // STRUCTURES_WRITE (administration et consultante) — le serveur le vérifie aussi.
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<CriterionGuidelineItem[] | null>(null);
  const [note, setNote] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const panelId = useId();
  const noteId = useId();

  useEffect(() => {
    if (!open || existing !== null) return;
    let cancelled = false;
    void listCriterionGuidelines(criterionId).then((result) => {
      if (!cancelled) setExisting(result ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, existing, criterionId]);

  function handleSubmit() {
    const trimmed = note.trim();
    if (trimmed.length === 0) return;
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await addCriterionGuidelines([criterionId], trimmed, aiEnabled);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNote("");
      setSaved(true);
      setExisting((await listCriterionGuidelines(criterionId)) ?? []);
    });
  }

  function handleToggleAi(guidelineId: string, enabled: boolean) {
    setError(null);
    // Réponse immédiate à l'écran ; l'état serveur est relu ensuite.
    setExisting((list) => list?.map((g) => (g.id === guidelineId ? { ...g, aiEnabled: enabled } : g)) ?? null);
    startTransition(async () => {
      const result = await setCriterionGuidelineAiUse(guidelineId, enabled);
      if (result && "error" in result) setError(result.error);
      setExisting((await listCriterionGuidelines(criterionId)) ?? []);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls={panelId}
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        Consignes pour l&apos;IA
        <span className="sr-only"> sur le critère {criterionCode}</span>
      </Button>
    );
  }

  return (
    <div id={panelId} className="space-y-3 rounded-lg border border-line bg-soft/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink2">
          Relues à chaque analyse d&apos;un document rattaché au critère {criterionCode}, pour toutes les structures.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} aria-expanded aria-controls={panelId}>
          Fermer
        </Button>
      </div>

      {existing === null && (
        <p role="status" className="flex items-center gap-2 text-ink2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Chargement des consignes…
        </p>
      )}
      {existing?.length === 0 && <p className="text-ink2">Aucune consigne sur ce critère pour l&apos;instant.</p>}
      {existing && existing.length > 0 && (
        <ul className="space-y-2" aria-label={`Consignes sur le critère ${criterionCode}`}>
          {existing.map((g) => (
            <li key={g.id} className="rounded-md border border-line bg-card px-3 py-2">
              <p className={cn("text-ink", !g.aiEnabled && "text-ink2")}>{g.note}</p>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
                <p className="text-sm text-ink2">
                  {g.createdByName} · {formatDate(g.createdAt)}
                </p>
                {canWrite ? (
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={g.aiEnabled}
                      disabled={isPending}
                      onChange={(e) => handleToggleAi(g.id, e.target.checked)}
                      className="h-4 w-4 accent-current"
                    />
                    Prise en compte par l&apos;IA
                  </label>
                ) : (
                  <p className="text-sm text-ink2">{g.aiEnabled ? "Prise en compte par l'IA" : "Non prise en compte"}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="space-y-2">
          <label htmlFor={noteId} className="block font-bold text-ink">
            Nouvelle consigne — une phrase courte
          </label>
          <Textarea
            id={noteId}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
            rows={2}
            maxLength={MAX_GUIDELINE_LENGTH}
            disabled={isPending}
            placeholder="ex : vérifier aussi la date de révision annuelle du règlement."
          />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={aiEnabled}
              disabled={isPending}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
            Faire prendre en compte par l&apos;IA dans les prochaines analyses
          </label>
          <div>
            <Button type="button" size="sm" disabled={isPending || note.trim().length === 0} onClick={handleSubmit}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Enregistrer la consigne
            </Button>
          </div>
        </div>
      )}

      {saved && (
        <div className="space-y-2">
          <p role="status" className="flex items-center gap-1.5 text-ok-text">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Consigne enregistrée. Relancez l&apos;analyse pour qu&apos;elle soit prise en compte maintenant.
          </p>
          {/* Enregistrer PUIS analyser (21/10/2026) : une analyse lancée avant ne lirait
              pas la consigne. */}
          {documentVersionId && <AnalyzeDocumentButton documentVersionId={documentVersionId} hasAnalysis />}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-danger-text">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
