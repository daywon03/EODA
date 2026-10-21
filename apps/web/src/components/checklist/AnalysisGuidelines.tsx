"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, MessageSquarePlus, X } from "lucide-react";
import {
  listCriteriaForPicker,
  addCriterionGuidelines,
  getGuidelineReach,
  listCriterionGuidelines,
  setCriterionGuidelineAiUse,
  type CriterionOption,
  type CriterionGuidelineItem,
} from "@/lib/actions/document";
import { MAX_GUIDELINE_LENGTH } from "@/lib/services/criterion-guideline-service";
import { formatDate } from "@/lib/services/date-format-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnalyzeDocumentButton } from "@/components/checklist/AnalyzeDocumentButton";

// « Que la base de connaissance apprenne des commentaires que mettra Sandrine lors
// des analyses, pour ne pas refaire les mêmes erreurs » (Damon, 10/09/2026), ANCRÉES
// SUR LE CRITÈRE HAS — cf. CriterionGuideline dans le schéma. Rappelée à toute
// analyse future d'un document rattaché à ce critère, quel que soit l'établissement.
//
// La consultante choisit elle-même le critère. Une guideline est relue pour tout
// document dont le TYPE est rattaché au critère (matrice) ou dont l'analyse a reconnu
// ce critère (suggestion non rejetée) — et seulement si elle est « prise en compte par
// l'IA » (call du 18/10/2026 : oui ou non, case à cocher, chaque bascule journalisée).
//
// Chargement paresseux : la liste des critères et les guidelines existantes ne sont
// demandées que si ce panneau est ouvert (P2/P3).
export function AnalysisGuidelines({ open, documentVersionId }: { open: boolean; documentVersionId: string | null }) {
  const [criteria, setCriteria] = useState<CriterionOption[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  // Plusieurs critères à la fois (21/10/2026) : on coche, on écrit UNE note, on
  // enregistre UNE fois, puis on relance l'analyse.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [existing, setExisting] = useState<CriterionGuidelineItem[] | null>(null);
  // Les critères dont la guideline sera relue pour CE document (getGuidelineReach).
  const [reach, setReach] = useState<{ ids: ReadonlySet<string>; typeLabel: string } | null>(null);
  const [note, setNote] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !documentVersionId || reach !== null) return;
    let cancelled = false;
    void getGuidelineReach(documentVersionId).then((result) => {
      if (!cancelled && result) setReach({ ids: new Set(result.criterionIds), typeLabel: result.documentTypeLabel });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentVersionId]);

  useEffect(() => {
    if (!open || criteria !== null) return;
    startTransition(async () => {
      // Déjà dans l'ordre NUMÉRIQUE (listCriteriaForPicker).
      const result = await listCriteriaForPicker();
      setCriteria(result ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Les guidelines existantes se montrent quand UN critère est coché : sur plusieurs,
  // la liste mélangerait des critères différents.
  const single = selected.size === 1 ? [...selected][0]! : null;
  useEffect(() => {
    setExisting(null);
    if (!single) return;
    let cancelled = false;
    void listCriterionGuidelines(single).then((result) => {
      if (!cancelled) setExisting(result ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [single]);

  function toggle(id: string) {
    setSaved(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    const trimmed = note.trim();
    if (selected.size === 0 || trimmed.length === 0) return;
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await addCriterionGuidelines([...selected], trimmed, aiEnabled);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNote("");
      setSaved(result.saved);
      if (single) setExisting((await listCriterionGuidelines(single)) ?? []);
    });
  }

  function handleToggleAi(guidelineId: string, enabled: boolean) {
    setError(null);
    // Réponse immédiate à l'écran ; l'état serveur est relu ensuite.
    setExisting((list) => list?.map((g) => (g.id === guidelineId ? { ...g, aiEnabled: enabled } : g)) ?? null);
    startTransition(async () => {
      const result = await setCriterionGuidelineAiUse(guidelineId, enabled);
      if (result && "error" in result) setError(result.error);
      if (single) setExisting((await listCriterionGuidelines(single)) ?? []);
    });
  }

  // Les critères cochés, rappelés au-dessus de la liste dans l'ordre numérique : on voit
  // ce qui sera enregistré sans faire défiler la liste (21/10/2026).
  const chosen = (criteria ?? []).filter((c) => selected.has(c.id));
  // Une guideline n'est relue que pour les critères rattachés au type du document ou
  // reconnus dans ce document : la poser ailleurs ne fait rien, et rien ne le disait.
  const unread = reach ? chosen.filter((c) => !reach.ids.has(c.id)) : [];

  const needle = filter.trim().toLowerCase();
  const visible = (criteria ?? []).filter(
    (c) => needle.length === 0 || c.code.startsWith(needle) || c.label.toLowerCase().includes(needle)
  );

  return (
    <div className="space-y-2 border-t border-gris-light pt-2">
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex min-h-11 items-center gap-1.5 text-xs text-accent-text hover:underline"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
          Ajouter une guideline sur des critères HAS
        </button>
      ) : (
        <div className="space-y-2">
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-brun-ancre">
              Critères concernés — cochez-en un ou plusieurs ({selected.size} coché{selected.size > 1 ? "s" : ""})
            </legend>
            {chosen.length > 0 && (
              <ul aria-label="Critères cochés" className="flex flex-wrap gap-1.5">
                {chosen.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      disabled={isPending}
                      aria-label={`Retirer le critère ${c.code}`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-card px-3 text-sm font-bold tabular-nums text-ink hover:bg-soft"
                    >
                      {c.code}
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {reach && unread.length > 0 && (
              <div role="note" className="rounded-md border border-amber-fill/40 bg-amber-fill/10 px-2.5 py-2 text-sm text-ink">
                <p className="flex items-start gap-1.5 font-bold">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-text" aria-hidden="true" />
                  {unread.map((c) => c.code).join(", ")} : pas lu{unread.length > 1 ? "s" : ""} pour ce document
                </p>
                <p className="mt-0.5 pl-5 text-ink2">
                  {unread.length > 1 ? "Ces critères ne sont pas rattachés" : "Ce critère n'est pas rattaché"} au type « {reach.typeLabel} ».
                  La guideline sera enregistrée, mais l&apos;analyse de ce document ne la lira pas. Pour faire vérifier{" "}
                  {unread.length > 1 ? "ces critères" : "ce critère"} dans ce type de document, rattachez-
                  {unread.length > 1 ? "les" : "le"} dans{" "}
                  <Link href="/dashboard/cabinet/criteres" className="font-bold text-accent-text underline">
                    Critères
                  </Link>
                  , puis relancez l&apos;analyse.
                </p>
              </div>
            )}
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrer : 3.12 ou « plaintes »"
              aria-label="Filtrer les critères"
              className="h-11 w-full rounded-md border border-gris-light bg-surface px-2 text-xs text-brun-ancre"
            />
            <ul className="max-h-60 space-y-0.5 overflow-y-auto rounded-md border border-gris-light bg-surface p-1">
              {criteria === null && <li className="px-2 py-1.5 text-xs text-ink2">Chargement des critères…</li>}
              {visible.map((c) => (
                <li key={c.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs text-brun-ancre hover:bg-soft">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      disabled={isPending}
                      onChange={() => toggle(c.id)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 accent-current"
                    />
                    <span>
                      <span className="font-bold tabular-nums">{c.code}</span> {c.label}
                      {c.requirementLevel === "IMPERATIF" && <span className="ml-1 font-bold text-accent-text">▲</span>}
                      {reach && reach.ids.has(c.id) && <span className="ml-1 text-ink2">· lu pour ce document</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {existing && existing.length > 0 && (
            <ul className="space-y-1.5">
              {existing.map((g) => (
                <li key={g.id} className="rounded-md bg-surface/70 px-2 py-1.5 text-xs text-brun-ancre">
                  <p className={cn(!g.aiEnabled && "text-ink2")}>{g.note}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-ink2">
                      {g.createdByName} · {formatDate(g.createdAt)}
                    </p>
                    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={g.aiEnabled}
                        disabled={isPending}
                        onChange={(e) => handleToggleAi(g.id, e.target.checked)}
                        className="h-4 w-4 accent-current"
                      />
                      Pris en compte par l&apos;IA
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <label className="block text-xs font-medium text-brun-ancre">
            Aide-mémoire court — une phrase, pas un paragraphe
          </label>
          <Textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(null);
            }}
            rows={2}
            maxLength={MAX_GUIDELINE_LENGTH}
            disabled={isPending || selected.size === 0}
            className="text-xs"
            placeholder="ex : vérifier aussi la date de révision annuelle du règlement."
          />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={aiEnabled}
              disabled={isPending || selected.size === 0}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="h-4 w-4 accent-current"
            />
            Faire prendre en compte par l&apos;IA dans les prochaines analyses
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || selected.size === 0 || note.trim().length === 0}
              onClick={handleSubmit}
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              Enregistrer{selected.size > 1 ? ` sur ${selected.size} critères` : ""}
            </Button>
            <button
              type="button"
              className="min-h-11 text-xs text-ink2 hover:underline"
              onClick={() => {
                setShowForm(false);
                setNote("");
                setSelected(new Set());
                setExisting(null);
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {saved !== null && (
        <div className="space-y-2 rounded-md border border-line bg-card p-2">
          <p role="status" className="flex items-center gap-1.5 text-xs text-ok-text">
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            Guideline enregistrée sur {saved} critère{saved > 1 ? "s" : ""}. Relancez l&apos;analyse pour
            qu&apos;elle soit prise en compte maintenant.
          </p>
          {/* Enregistrer PUIS analyser (21/10/2026) : le bouton vient juste après
              l'enregistrement, jamais avant — une analyse lancée avant ne lirait pas
              la guideline. */}
          {documentVersionId && <AnalyzeDocumentButton documentVersionId={documentVersionId} hasAnalysis />}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

