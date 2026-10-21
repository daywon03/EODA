"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/services/structure-documents-service";
import type { DocumentCategory } from "@eoda/database";
import { changeDocumentType, listDocumentTypeOptions, updateAnalysisDirective } from "@/lib/actions/document";
import { MAX_ANALYSIS_DIRECTIVE_LENGTH } from "@/lib/services/analysis-directive-service";

type TypeOption = { id: string; label: string; category: DocumentCategory };

// Deux réglages du document qui ne sont pas des gestes sur une VERSION, et qui
// n'avaient nulle part où vivre (20/10/2026, demande de Damon) :
//
//   1. Le TYPE sous lequel le fichier est rangé. Il venait d'une devinette au dépôt
//      et ne se corrigeait plus — or tout le reste en dépend : la checklist qui
//      l'affiche, les critères rattachés à son type, donc l'analyse.
//   2. Une CONSIGNE libre pour l'analyse (« c'est la synthèse 2025, pas l'enquête »),
//      avec le bouton qui décide si elle entre dans la prochaine analyse. La consigne
//      est conservée quand le bouton est éteint : une note de travail ne s'efface pas
//      parce qu'on la met de côté.
//
// Ce composant ne fait que l'état local et les appels : les gardes, la validation, la
// transaction et la journalisation vivent dans lib/actions/document.ts.
export function DocumentSettingsPanel({
  establishmentId,
  documentTypeId,
  currentLabel,
  currentCategory,
  directive,
  includeInAnalysis,
}: {
  establishmentId: string;
  documentTypeId: string;
  currentLabel: string;
  currentCategory: DocumentCategory;
  directive: string | null;
  includeInAnalysis: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<TypeOption[] | null>(null);
  const [selectedType, setSelectedType] = useState(documentTypeId);
  const [text, setText] = useState(directive ?? "");
  const [included, setIncluded] = useState(includeInAnalysis);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  // La liste des types possibles n'est chargée qu'à l'ouverture : la fiche d'un
  // document n'a pas besoin de soixante-six lignes pour s'afficher.
  useEffect(() => {
    if (!open || options !== null) return;
    let cancelled = false;
    void listDocumentTypeOptions(establishmentId).then((list) => {
      if (!cancelled) setOptions(list ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, options, establishmentId]);

  function saveDirective() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateAnalysisDirective(establishmentId, documentTypeId, text, included);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  const grouped = new Map<DocumentCategory, TypeOption[]>();
  for (const option of options ?? []) {
    const key = option.category;
    grouped.set(key, [...(grouped.get(key) ?? []), option]);
  }

  return (
    <div className="border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg text-left text-sm font-bold text-ink focus-visible:-outline-offset-4"
      >
        <span aria-hidden="true" className="text-ink2">
          {open ? "▾" : "▸"}
        </span>
        Classement et consigne d&apos;analyse
      </button>

      {open && (
        <div className="mt-3 space-y-5">
          {/* ── Type du document ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-sm font-bold text-ink">Ce document est rangé sous</p>
            <p className="text-sm text-ink2">
              {currentLabel} · {DOCUMENT_CATEGORY_LABELS[currentCategory]}
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-ink">Le reclasser sous</span>
              <Select
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                disabled={isPending || options === null}
              >
                {/* Le type courant reste proposé même s'il sort de la liste filtrée
                    (offre modifiée depuis le dépôt) : sinon la valeur du <select> ne
                    correspondrait à aucune option. */}
                {options === null && <option value={documentTypeId}>{currentLabel}</option>}
                {[...grouped.entries()].map(([category, items]) => (
                  <optgroup key={category} label={DOCUMENT_CATEGORY_LABELS[category]}>
                    {items.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </label>

            {selectedType !== documentTypeId && (
              <div className="rounded-lg border border-line bg-soft p-3 text-sm text-ink">
                <p className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-text" aria-hidden="true" />
                  <span>
                    Reclasser <strong>efface l&apos;analyse actuelle</strong> (elle portait sur les critères de
                    l&apos;autre type). Les fichiers et l&apos;historique sont conservés : il faudra relancer
                    « Analyser » pour obtenir l&apos;analyse du nouveau type.
                  </span>
                </p>
                <div className="mt-2">
                  <ConfirmActionButton
                    label="Reclasser ce document"
                    question={`Reclasser « ${currentLabel} » sous le type choisi ? L'analyse actuelle sera effacée et devra être relancée.`}
                    confirmLabel="Reclasser"
                    tone="neutral"
                    disabled={isPending}
                    onConfirm={async () => {
                      const result = await changeDocumentType(establishmentId, documentTypeId, selectedType);
                      if (result && "error" in result) return result;
                      // Rechargement complet : la checklist, les critères et l'analyse
                      // changent d'un coup, et le panneau porte l'ancien type.
                      window.location.reload();
                      return null;
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Consigne d'analyse ───────────────────────────────────────── */}
          <div className="space-y-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-bold text-ink">Consigne pour l&apos;analyse</span>
              <span className="text-sm text-ink2">
                Ce que vous savez de ce document et que le modèle ne peut pas deviner. Une consigne oriente ce
                qu&apos;il cherche ; elle ne peut pas lui faire conclure qu&apos;un document est conforme.
              </span>
              <Textarea
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setSaved(false);
                }}
                rows={3}
                maxLength={MAX_ANALYSIS_DIRECTIVE_LENGTH}
                placeholder="Ex. : il s'agit de la synthèse 2025 des enquêtes, pas du questionnaire vierge."
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={included}
                onChange={(event) => {
                  setIncluded(event.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-terre"
              />
              <span>Prendre en compte dans la prochaine analyse</span>
            </label>

            {error && (
              <p role="alert" className="text-sm font-bold text-danger-text">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={saveDirective} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer la consigne"
                )}
              </Button>
              {saved && !isPending && (
                <span className="flex items-center gap-1 text-sm text-ok-text">
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Consigne enregistrée
                </span>
              )}
            </div>
            <p className="text-sm text-ink2">
              Enregistrer ne relance pas l&apos;analyse : elle sera transmise à la prochaine, au dépôt d&apos;une
              nouvelle version ou via « Analyser ».
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
