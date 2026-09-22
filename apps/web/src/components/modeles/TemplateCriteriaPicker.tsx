"use client";

import { useState, useTransition } from "react";
import { setTemplateCriteria } from "@/lib/actions/template-library";
import type { CriterionOption } from "@/lib/actions/document";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

// Un <select multiple> natif est illisible au-delà d'une vingtaine d'options — la
// bibliothèque en a 157. Filtre texte + cases à cocher, même palette EODA que le
// reste des formulaires du dépôt.
//
// « Savoir quel document est lié à quel critère » (Damon, 16/09/2026) : ce
// sélecteur remplace la liste enregistrée en un seul appel plutôt que
// d'attacher/détacher critère par critère (cf. setTemplateCriteria).
export function TemplateCriteriaPicker({
  templateId,
  allCriteria,
  initialSelected,
}: {
  templateId: string;
  allCriteria: CriterionOption[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filtered = allCriteria.filter((c) =>
    `${c.code} ${c.label}`.toLowerCase().includes(filter.toLowerCase())
  );

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setTemplateCriteria(templateId, [...selected]);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrer par code ou intitulé…"
        aria-label="Filtrer les critères HAS"
      />
      <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-gris-light p-2">
        {filtered.map((c) => (
          <li key={c.id}>
            <label
              className={`flex items-start gap-2 rounded px-1 py-0.5 text-xs text-brun-ancre ${
                c.requirementLevel === "IMPERATIF" ? "bg-terre/10" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="mt-0.5"
              />
              <span>
                {c.requirementLevel === "IMPERATIF" && (
                  <span
                    className="mr-1 rounded bg-terre px-1 py-0.5 text-[10px] font-semibold uppercase text-white"
                    title="Critère impératif HAS — obligatoire pour l'évaluation"
                  >
                    Impératif
                  </span>
                )}
                <span className="font-medium">{c.code}</span> — {c.label}
              </span>
            </label>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-xs text-gris-mid">Aucun critère ne correspond au filtre.</li>
        )}
      </ul>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Enregistrer les critères rattachés
        </Button>
        <span className="text-xs text-gris-mid">{selected.size} sélectionné(s)</span>
      </div>
      {saved && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-vert-ok">
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Critères enregistrés.
        </p>
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
