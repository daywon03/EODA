"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Search, X } from "lucide-react";
import {
  addManualMatrixLinks,
  getDocumentTypeLinks,
  unlinkCriterionFromDocumentType,
  type DocumentTypeLink,
} from "@/lib/actions/criterion-matrix";
import { listCriteriaForPicker, type CriterionOption } from "@/lib/actions/document";
import {
  filterLinkableCriteria,
  linkedCriteriaMessage,
  unlinkCriterionQuestion,
  unlinkedCriterionMessage,
} from "@/lib/services/criterion-linker-service";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";

// ─────────────────────────────────────────────────────────────────────────────
// LES CRITÈRES HAS D'UN TYPE DE DOCUMENT — un seul composant, trois menus (retours de
// Sandrine, 09/11/2026 : « je veux une liste des critères, je coche ce qui est bon,
// je décoche ce qui ne l'est pas » ; « il faut pouvoir faire la même chose depuis
// plusieurs menus »). Monté dans la fiche document (onglet « Critères HAS »), dans la
// matrice et, par la page Critères d'une structure, via le choix d'une ligne.
//
// Rattacher = cocher dans la liste du référentiel en base (recherche par numéro ou par
// mot — plus jamais de code à recopier). Retirer = décocher : un critère proposé par
// la matrice est alors REFUSÉ, un ajout à la main est retiré — le serveur choisit
// (unlinkCriterionFromDocumentType). Tout est recalculé côté serveur ; la liste vaut
// pour toutes les structures, et le composant le dit.
// ─────────────────────────────────────────────────────────────────────────────

type Message = { tone: "ok" | "error"; text: string };

const plural = (n: number, word: string): string => `${n} ${word}${n > 1 ? "s" : ""}`;

export function CriterionLinker({ typeCode, canEdit }: { typeCode: string; canEdit: boolean }) {
  const [links, setLinks] = useState<DocumentTypeLink[] | null>(null);
  const [criteria, setCriteria] = useState<CriterionOption[] | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchId = useId();
  const listId = useId();

  useEffect(() => {
    let cancelled = false;
    void getDocumentTypeLinks(typeCode).then((list) => {
      if (!cancelled) setLinks(list);
    });
    return () => {
      cancelled = true;
    };
  }, [typeCode]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    // Déjà dans l'ordre numérique du référentiel (listCriteriaForPicker).
    void listCriteriaForPicker().then((list) => {
      if (!cancelled) setCriteria(list ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  const linkedCodes = new Set((links ?? []).map((l) => l.code));
  const visible = filterLinkableCriteria(criteria ?? [], query, linkedCodes);

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
    if (selected.size === 0) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addManualMatrixLinks(typeCode, [...selected]);
      if ("error" in result) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setSelected(new Set());
      setLinks(await getDocumentTypeLinks(typeCode));
      setMessage({ tone: "ok", text: linkedCriteriaMessage(result.added) });
    });
  }

  async function unlink(code: string) {
    const result = await unlinkCriterionFromDocumentType(typeCode, code);
    if (!result) {
      setLinks(await getDocumentTypeLinks(typeCode));
      setMessage({ tone: "ok", text: unlinkedCriterionMessage(code) });
    }
    return result;
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby={`${listId}-linked`} className="space-y-2">
        <h3 id={`${listId}-linked`} className="font-bold text-ink">
          Critères couverts{links ? ` (${links.length})` : ""}
        </h3>
        {links === null && (
          <p role="status" className="flex items-center gap-2 text-ink2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Chargement des critères…
          </p>
        )}
        {links?.length === 0 && (
          <p className="text-ink2">
            Aucun critère n&apos;est rattaché à ce document.{canEdit ? " Cochez-en dans la liste ci-dessous." : ""}
          </p>
        )}
        {links && links.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {links.map((l) => (
              <li key={l.code} className="flex items-start justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="font-bold tabular-nums text-ink">{l.code}</span>
                  <span className="text-ink"> — {l.label}</span>
                  <span className="block text-sm text-ink2">{l.proposed ? "Proposé par la matrice" : "Ajouté à la main"}</span>
                </span>
                {canEdit && (
                  <ConfirmActionButton
                    appearance="link"
                    align="end"
                    label="Retirer"
                    accessibleLabel={`Retirer le critère ${l.code}`}
                    icon={X}
                    question={unlinkCriterionQuestion(l.code, l.proposed)}
                    confirmLabel="Retirer"
                    onConfirm={() => unlink(l.code)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && links && (
        <fieldset className="space-y-2">
          <legend className="font-bold text-ink">Rattacher d&apos;autres critères</legend>
          <p className="text-sm text-ink2">Vaut pour toutes les structures. Cherchez par numéro (3.14) ou par mot (crise).</p>
          <label htmlFor={searchId} className="sr-only">
            Chercher un critère par numéro ou par mot
          </label>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink2" aria-hidden="true" />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="3.14 ou « crise »"
              className="h-11 w-full rounded-md border border-line bg-card pl-9 pr-3 text-ink placeholder:text-ink2"
            />
          </span>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border border-line p-1" aria-label="Critères du référentiel">
            {criteria === null && <li className="px-2 py-1.5 text-ink2">Chargement du référentiel…</li>}
            {criteria !== null && visible.length === 0 && (
              <li className="px-2 py-1.5 text-ink2">Aucun critère ne correspond à « {query} ».</li>
            )}
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
                    {c.requirementLevel === "IMPERATIF" && <span className="ml-1 text-sm font-bold text-accent-text">(impératif)</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button type="button" onClick={link} disabled={isPending || selected.size === 0}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {selected.size > 0 ? `Rattacher ${plural(selected.size, "critère")}` : "Cochez un critère à rattacher"}
          </Button>
        </fieldset>
      )}

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={message.tone === "error" ? "text-danger-text" : "flex items-center gap-1.5 text-ok-text"}
        >
          {message.tone === "ok" && <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
          {message.text}
        </p>
      )}
    </div>
  );
}
