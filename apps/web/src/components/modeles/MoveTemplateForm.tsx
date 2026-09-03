"use client";

import { useState } from "react";
import { moveTemplateToCategory, type CategorySummary } from "@/lib/actions/template-library";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

// « Que l'on puisse ensuite les réarranger » (call du 03/09). Un import de dossier
// range au mieux, pas juste à tous les coups — et l'arborescence d'un poste ne suit
// pas forcément celle qu'on veut dans la bibliothèque.
//
// Pas de bouton « Enregistrer » : choisir un dossier EST l'action. Un second geste
// pour confirmer un choix qui n'a qu'une valeur possible se saute, et le déplacement
// n'a alors jamais lieu.
export function MoveTemplateForm({
  templateId,
  categoryId,
  categories,
}: {
  templateId: string;
  categoryId: string;
  categories: CategorySummary[];
}) {
  const [isPending, setPending] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] space-y-1.5">
        <Label htmlFor="move-category">Dossier</Label>
        <Select
          id="move-category"
          value={categoryId}
          disabled={isPending}
          onChange={(event) => {
            const next = event.target.value;
            if (next === categoryId) return;
            setPending(true);
            void moveTemplateToCategory(templateId, next).finally(() => setPending(false));
          }}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>
      {isPending && (
        <p className="flex items-center gap-1.5 pb-3 text-xs text-gris-mid" role="status">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Déplacement…
        </p>
      )}
    </div>
  );
}
