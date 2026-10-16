"use client";

import { useRouter } from "next/navigation";
import type { CriterionOption } from "@/lib/actions/document";

// « Savoir quel document est lié à quel critère » (Damon, 16/09/2026), dans l'autre
// sens : parcourir la bibliothèque par critère plutôt que fiche par fiche. Un
// <select> qui navigue au changement — pas de bouton "Filtrer" séparé, la liste
// affichée doit toujours correspondre à ce que le champ affiche.
export function TemplateCriterionFilter({
  allCriteria,
  selectedCriterionId,
}: {
  allCriteria: CriterionOption[];
  selectedCriterionId: string | undefined;
}) {
  const router = useRouter();

  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <label htmlFor="critere-filter" className="text-sm font-medium text-brun-ancre">
        Filtrer par critère HAS
      </label>
      <select
        id="critere-filter"
        value={selectedCriterionId ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          router.push(
            value
              ? `/dashboard/cabinet/modeles?critere=${value}`
              : "/dashboard/cabinet/modeles"
          );
        }}
        className="h-11 w-full min-w-0 max-w-full rounded-md border border-gris-light bg-surface px-2 text-base text-brun-ancre sm:w-auto sm:max-w-md"
      >
        <option value="">Tous les modèles</option>
        {allCriteria.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.label.slice(0, 60)}
          </option>
        ))}
      </select>
    </div>
  );
}
