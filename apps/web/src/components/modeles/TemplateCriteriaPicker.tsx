"use client";

import { useMemo, useState, useTransition } from "react";
import { setTemplateCriteria } from "@/lib/actions/template-library";
import type { CriterionOption } from "@/lib/actions/document";
import {
  countImperatives,
  groupCriteriaForPicker,
} from "@/lib/services/criterion-picker-service";
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
//
// « Les 157 critères… j'ai mal à la tête » puis « tu ne mets que les impératifs dans
// EODA dans ta partie » (Sandrine, 20/09/2026) : les critères sont rangés par
// chapitre puis par thématique, impératifs en tête de chaque thématique, et une case
// à cocher ramène la liste aux seuls impératifs. Le rangement vient du référentiel
// en base, jamais d'une liste recopiée ici.
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
  const [imperativesOnly, setImperativesOnly] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const imperativeCount = useMemo(() => countImperatives(allCriteria), [allCriteria]);
  const groups = useMemo(
    () => groupCriteriaForPicker(allCriteria, { imperativesOnly, query: filter }),
    [allCriteria, imperativesOnly, filter]
  );
  const visibleCount = groups.reduce((total, chapter) => total + chapter.criteriaCount, 0);

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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={imperativesOnly}
            onChange={(e) => setImperativesOnly(e.target.checked)}
          />
          Impératifs seulement ({imperativeCount})
        </label>
        <span className="text-xs text-ink2">
          {visibleCount} critère{visibleCount > 1 ? "s" : ""} affiché{visibleCount > 1 ? "s" : ""}
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-md border border-gris-light p-2">
        {groups.map((chapter) => (
          <section key={chapter.number} className="mb-3 last:mb-0">
            <p className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs font-semibold text-brun-ancre">
              <span>
                Chapitre {chapter.number} — {chapter.name}
              </span>
              <span className="font-normal text-ink2">
                {chapter.criteriaCount} critère{chapter.criteriaCount > 1 ? "s" : ""}
                {chapter.imperativesCount > 0 && ` · ${chapter.imperativesCount} impératif(s)`}
              </span>
            </p>
            {chapter.themes.map((theme) => (
              <div key={theme.code} className="mb-2 last:mb-0">
                <p className="text-xs text-ink2">
                  {theme.code} · {theme.name}
                </p>
                <ul aria-label={`${theme.code} ${theme.name}`} className="space-y-1">
                  {theme.criteria.map((c) => (
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
                              className="mr-1 rounded bg-terre px-1 py-0.5 text-sm font-semibold uppercase text-white"
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
                </ul>
              </div>
            ))}
          </section>
        ))}
        {groups.length === 0 && (
          <p className="text-xs text-ink2">Aucun critère ne correspond au filtre.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={isPending} onClick={handleSave}>
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Enregistrer les critères rattachés
        </Button>
        <span className="text-xs text-ink2">{selected.size} sélectionné(s)</span>
      </div>
      {saved && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-ok-text">
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
