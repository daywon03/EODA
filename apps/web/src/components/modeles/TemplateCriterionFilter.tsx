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
    <div className="flex items-center gap-2">
      <label htmlFor="critere-filter" className="text-xs font-medium text-brun-ancre">
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
        className="rounded-md border border-gris-light bg-white px-2 py-1.5 text-xs text-brun-ancre"
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
