"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import {
  addManualMatrixLinks,
  getDocumentTypeLinks,
  removeManualMatrixLink,
  type DocumentTypeLink,
} from "@/lib/actions/criterion-matrix";
import { listCriteriaForPicker, type CriterionOption } from "@/lib/actions/document";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";

// Rattacher À LA MAIN des critères à un type de document (call du 21/10/2026) : la
// proposition ne citait pas, pour l'enquête de satisfaction, les critères que le
// manuel attend d'une instance de participation. On choisit le type, on coche les
// critères (ordre numérique, filtre), on rattache en une fois, puis on relance
// l'analyse des documents concernés. Le serveur recalcule tout (planManualLinks).
export function ManualMatrixLink({ documentTypes }: { documentTypes: readonly { code: string; label: string }[] }) {
  const [typeCode, setTypeCode] = useState("");
  const [links, setLinks] = useState<DocumentTypeLink[] | null>(null);
  const [criteria, setCriteria] = useState<CriterionOption[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const typeId = useId();

  useEffect(() => {
    let cancelled = false;
    // Déjà dans l'ordre numérique (listCriteriaForPicker).
    void listCriteriaForPicker().then((list) => {
      if (!cancelled) setCriteria(list ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLinks(null);
    setSelected(new Set());
    setMessage(null);
    if (!typeCode) return;
    let cancelled = false;
    void getDocumentTypeLinks(typeCode).then((list) => {
      if (!cancelled) setLinks(list);
    });
    return () => {
      cancelled = true;
    };
  }, [typeCode]);

  const linkedCodes = new Set((links ?? []).map((l) => l.code));
  const needle = filter.trim().toLowerCase();
  const visible = (criteria ?? []).filter(
    (c) => !linkedCodes.has(c.code) && (needle === "" || c.code.startsWith(needle) || c.label.toLowerCase().includes(needle))
  );
  const chosen = (criteria ?? []).filter((c) => selected.has(c.code));

  function toggle(code: string) {
    setMessage(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function link() {
    if (!typeCode || selected.size === 0) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addManualMatrixLinks(typeCode, [...selected]);
      if ("error" in result) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setSelected(new Set());
      setLinks(await getDocumentTypeLinks(typeCode));
      setMessage({
        tone: "ok",
        text: `${result.added} critère${result.added > 1 ? "s" : ""} rattaché${result.added > 1 ? "s" : ""}. Relancez l'analyse des documents de ce type pour qu'ils soient vérifiés.`,
      });
    });
  }

  async function unlink(code: string) {
    const result = await removeManualMatrixLink(typeCode, code);
    if (!result) setLinks(await getDocumentTypeLinks(typeCode));
    return result;
  }

  return (
    <div className="space-y-4 rounded-xl border border-line bg-card p-5">
      <label htmlFor={typeId} className="block space-y-1">
        <span className="font-bold text-ink">Type de document</span>
        <Select id={typeId} value={typeCode} onChange={(e) => setTypeCode(e.target.value)} disabled={isPending}>
          <option value="">Choisir un type…</option>
          {documentTypes.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
            </option>
          ))}
        </Select>
      </label>

      {typeCode && links === null && <p className="text-ink2">Chargement des rattachements…</p>}

      {links && (
        <div className="space-y-2">
          <p className="font-bold text-ink">
            Déjà rattachés ({links.length})
          </p>
          {links.length === 0 ? (
            <p className="text-ink2">Aucun critère n&apos;est rattaché à ce type.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {links.map((l) => (
                <li key={l.code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-bold tabular-nums text-ink">{l.code}</span>
                    <span className="text-ink"> — {l.label}</span>
                    <span className="block text-sm text-ink2">{l.proposed ? "Proposition du 08/10" : "Ajouté à la main"}</span>
                  </span>
                  {!l.proposed && (
                    <ConfirmActionButton
                      appearance="link"
                      label="Retirer"
                      accessibleLabel={`Retirer le critère ${l.code}`}
                      icon={X}
                      question={`Retirer ${l.code} de ce type ? Les analyses suivantes ne le vérifieront plus pour ces documents.`}
                      confirmLabel="Retirer"
                      onConfirm={() => unlink(l.code)}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {links && (
        <fieldset className="space-y-2">
          <legend className="font-bold text-ink">
            Ajouter des critères ({selected.size} coché{selected.size > 1 ? "s" : ""})
          </legend>
          {chosen.length > 0 && (
            <ul aria-label="Critères cochés" className="flex flex-wrap gap-1.5">
              {chosen.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => toggle(c.code)}
                    disabled={isPending}
                    aria-label={`Retirer le critère ${c.code} de la sélection`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line bg-card px-3 text-sm font-bold tabular-nums text-ink hover:bg-soft"
                  >
                    {c.code}
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer : 1.3 ou « participation »"
            aria-label="Filtrer les critères"
            className="h-11 w-full rounded-md border border-line bg-card px-3 text-ink placeholder:text-ink2"
          />
          <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border border-line p-1">
            {criteria === null && <li className="px-2 py-1.5 text-ink2">Chargement des critères…</li>}
            {visible.map((c) => (
              <li key={c.code}>
                <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-ink hover:bg-soft">
                  <input
                    type="checkbox"
                    checked={selected.has(c.code)}
                    disabled={isPending}
                    onChange={() => toggle(c.code)}
                    className="mt-1 h-4 w-4 flex-shrink-0 accent-current"
                  />
                  <span>
                    <span className="font-bold tabular-nums">{c.code}</span> {c.label}
                    {c.requirementLevel === "IMPERATIF" && <span className="ml-1 font-bold text-accent-text">▲</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={link} disabled={isPending || selected.size === 0}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Rattacher {selected.size > 0 ? `${selected.size} critère${selected.size > 1 ? "s" : ""}` : ""}
            </Button>
          </div>
        </fieldset>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={message.tone === "error" ? "text-danger-text" : "flex items-center gap-1.5 text-ok-text"}
        >
          {message.tone === "ok" && <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          {message.text}
        </p>
      )}
    </div>
  );
}
