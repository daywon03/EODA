"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Download, Loader2, Pencil, Sparkles, X } from "lucide-react";
import {
  getCorrectedDraft,
  generateDocumentDraft,
  saveDocumentDraft,
  getExtractedText,
} from "@/lib/actions/document";
import { buildDraftDiff, type DraftDiffSegment } from "@/lib/services/document-diff-service";
import { LLM_MODEL_OPTIONS, DEFAULT_LLM_MODEL_ID } from "@/lib/llm/openrouter-models";
import { formatDate } from "@/lib/services/date-format-service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// « Régénérer un document entier corrigé, brandé EODA, qu'ils pourront réutiliser
// ensuite » (Damon, 15/09/2026) — panneau latéral (« pop up à droite »), pas une
// page séparée : la version corrigée se lit et se retouche à côté de la
// checklist qui l'a déclenchée.
//
// Réservé au cabinet, comme AnalyzeDocumentButton : un brouillon non relu ne va
// jamais devant le client (même barrière que l'analyse elle-même).
export function CorrectedDraftPanel({ documentVersionId }: { documentVersionId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-terre hover:underline"
      >
        <Pencil className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
        Document corrigé
      </button>

      {open && <DraftDrawer documentVersionId={documentVersionId} onClose={() => setOpen(false)} />}
    </>
  );
}

function DraftDrawer({ documentVersionId, onClose }: { documentVersionId: string; onClose: () => void }) {
  const [modelId, setModelId] = useState(DEFAULT_LLM_MODEL_ID);
  const [draft, setDraft] = useState<{ markdown: string; generatedAt: Date } | null | undefined>(undefined);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [mode, setMode] = useState<"diff" | "edit">("diff");
  const [editedMarkdown, setEditedMarkdown] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [existingDraft, extracted] = await Promise.all([
        getCorrectedDraft(documentVersionId),
        getExtractedText(documentVersionId),
      ]);
      setDraft(existingDraft ?? null);
      setEditedMarkdown(existingDraft?.markdown ?? "");
      setOriginalText(extracted && "text" in extracted ? extracted.text : "");
    });
  }, [documentVersionId]);

  function handleGenerate() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await generateDocumentDraft(documentVersionId, modelId);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      const refreshed = await getCorrectedDraft(documentVersionId);
      setDraft(refreshed ?? null);
      setEditedMarkdown(refreshed?.markdown ?? "");
      setMode("diff");
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveDocumentDraft(documentVersionId, editedMarkdown);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      const refreshed = await getCorrectedDraft(documentVersionId);
      setDraft(refreshed ?? null);
      setSaved(true);
    });
  }

  const diffSegments: DraftDiffSegment[] =
    draft && originalText !== null ? buildDraftDiff(originalText, draft.markdown) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brun-ancre/30" role="dialog" aria-modal="true">
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-gris-light px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-ambre" aria-hidden="true" />
            <h2 className="text-sm font-medium text-brun-ancre">Document corrigé — brouillon IA</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-gris-mid hover:text-brun-ancre">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {draft === undefined && (
            <p className="flex items-center gap-2 text-xs text-gris-mid">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Chargement…
            </p>
          )}

          {draft === null && (
            <div className="space-y-2">
              <p className="text-xs text-gris-mid">
                Aucun brouillon généré pour cette version. L&apos;IA réécrit le document en intégrant les
                éléments manquants et les suggestions de l&apos;analyse.
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  disabled={isPending}
                  aria-label="Modèle IA pour la génération"
                  className="rounded-md border border-gris-light bg-white px-1.5 py-1 text-xs text-brun-ancre"
                >
                  {LLM_MODEL_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" disabled={isPending} onClick={handleGenerate}>
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Générer
                </Button>
              </div>
            </div>
          )}

          {draft && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gris-mid">
                  Généré le {formatDate(draft.generatedAt)} — brouillon de travail, à relire avant tout usage.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("diff")}
                    className={`text-xs ${mode === "diff" ? "font-medium text-terre" : "text-gris-mid hover:underline"}`}
                  >
                    Avant / après
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("edit")}
                    className={`text-xs ${mode === "edit" ? "font-medium text-terre" : "text-gris-mid hover:underline"}`}
                  >
                    Modifier
                  </button>
                </div>
              </div>

              {mode === "diff" ? (
                <div className="rounded-lg border border-gris-light bg-ivoire/40 p-3 text-xs leading-relaxed text-brun-ancre whitespace-pre-wrap">
                  {diffSegments.map((segment, index) => {
                    if (segment.kind === "removed") {
                      return (
                        <span key={index} className="text-rouge-imp line-through decoration-2">
                          {segment.text}
                        </span>
                      );
                    }
                    if (segment.kind === "added") {
                      return (
                        <span key={index} className="text-vert-ok underline decoration-2">
                          {segment.text}
                        </span>
                      );
                    }
                    return <span key={index}>{segment.text}</span>;
                  })}
                </div>
              ) : (
                <Textarea
                  value={editedMarkdown}
                  onChange={(e) => setEditedMarkdown(e.target.value)}
                  rows={20}
                  className="text-xs font-mono"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                {mode === "edit" && (
                  <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Enregistrer
                  </Button>
                )}
                <a
                  href={`/api/documents/${documentVersionId}/draft-docx`}
                  className="inline-flex items-center gap-1.5 text-xs text-terre hover:underline"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Télécharger le .docx
                </a>
                <div className="flex items-center gap-2">
                  <select
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    disabled={isPending}
                    aria-label="Modèle IA pour la régénération"
                    className="rounded-md border border-gris-light bg-white px-1.5 py-1 text-xs text-brun-ancre"
                  >
                    {LLM_MODEL_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isPending}
                    className="text-xs text-gris-mid hover:underline"
                  >
                    Régénérer
                  </button>
                </div>
              </div>

              {saved && <p role="status" className="text-xs text-vert-ok">Modifications enregistrées.</p>}
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
