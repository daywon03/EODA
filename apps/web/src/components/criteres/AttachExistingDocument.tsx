"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";
import { addManualMatrixLinks, listLinkableDocumentTypes } from "@/lib/actions/criterion-matrix";
import { documentTypeLabelKey } from "@/lib/services/document-type-creation-service";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type LinkableType = { id: string; code: string; label: string };

// « Rattacher un document existant à ce critère » (page Critères d'une structure,
// retours de Sandrine du 09/11/2026 : « il faut pouvoir faire la même chose depuis
// plusieurs menus »). Choisir une ligne DÉJÀ dans la liste « Documents » — et non plus
// seulement en créer une. Même écriture que la matrice et la fiche document
// (addManualMatrixLinks, CABINET_ADMIN, vaut pour toutes les structures).
//
// La liste des lignes n'est lue qu'au clic : la page compte un formulaire par critère,
// les charger toutes d'emblée ferait 137 lectures pour rien.
export function AttachExistingDocument({
  criterionCode,
  linkedDocumentTypeIds,
}: {
  criterionCode: string;
  linkedDocumentTypeIds: readonly string[];
}) {
  const router = useRouter();
  const [types, setTypes] = useState<LinkableType[] | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectId = useId();

  function start() {
    setOpen(true);
    if (types !== null) return;
    startTransition(async () => {
      setTypes(await listLinkableDocumentTypes());
    });
  }

  function attach() {
    if (!typeCode) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addManualMatrixLinks(typeCode, [criterionCode]);
      if ("error" in result) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setOpen(false);
      setTypeCode("");
      setMessage({ tone: "ok", text: `Document rattaché au critère ${criterionCode}, pour toutes les structures.` });
      router.refresh();
    });
  }

  const needle = documentTypeLabelKey(filter);
  const linked = new Set(linkedDocumentTypeIds);
  const candidates = (types ?? []).filter(
    (t) => !linked.has(t.id) && (needle === "" || t.code === typeCode || documentTypeLabelKey(t.label).includes(needle))
  );

  return (
    <div className="space-y-2">
      {!open && (
        <button
          type="button"
          onClick={start}
          className="inline-flex min-h-11 items-center gap-1.5 font-bold text-accent-text hover:underline"
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Rattacher un document existant à ce critère
        </button>
      )}
      {open && (
        <div className="space-y-2 rounded-lg border border-line bg-card p-3">
          {types === null ? (
            <p role="status" className="flex items-center gap-2 text-ink2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Chargement de la liste des documents…
            </p>
          ) : (
            <>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Chercher un document : « livret », « crise »…"
                aria-label="Chercher un document de la liste"
                className="h-11 w-full rounded-md border border-line bg-card px-3 text-ink placeholder:text-ink2"
              />
              <label htmlFor={selectId} className="block space-y-1">
                <span className="font-bold text-ink">Document de la liste ({candidates.length})</span>
                <Select id={selectId} value={typeCode} onChange={(e) => setTypeCode(e.target.value)} disabled={isPending}>
                  <option value="">Choisir un document…</option>
                  {candidates.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={attach} disabled={isPending || !typeCode}>
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Rattacher au critère {criterionCode}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Annuler
                </Button>
              </div>
            </>
          )}
        </div>
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
