"use client";

import { useState } from "react";
import {
  createCategoryAndMoveTemplate,
  moveTemplateToCategory,
  type CategorySummary,
} from "@/lib/actions/template-library";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2 } from "lucide-react";

// Valeur de contrôle du `<select>`, jamais un identifiant de dossier réel — un
// cuid pourrait un jour commencer autrement, mais jamais coïncider avec ce
// marqueur choisi à la main.
const OTHER_VALUE = "__autre__";

// « Que l'on puisse ensuite les réarranger » (call du 03/09). Un import de dossier
// range au mieux, pas juste à tous les coups — et l'arborescence d'un poste ne suit
// pas forcément celle qu'on veut dans la bibliothèque.
//
// Pas de bouton « Enregistrer » sur le choix d'un dossier EXISTANT : le choisir EST
// l'action. « Autre » bascule sur un champ texte + bouton, parce que là il y a bien
// deux gestes distincts — nommer, puis confirmer (10/09/2026, demande de Damon).
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
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSelectChange(value: string) {
    setError(null);
    if (value === OTHER_VALUE) {
      setCreatingNew(true);
      return;
    }
    if (value === categoryId) return;
    setPending(true);
    void moveTemplateToCategory(templateId, value).finally(() => setPending(false));
  }

  function handleCreateAndMove() {
    const trimmed = newName.trim();
    if (trimmed.length === 0) return;
    setError(null);
    setPending(true);
    void createCategoryAndMoveTemplate(templateId, trimmed)
      .then((result) => {
        if (result && "error" in result) {
          setError(result.error);
          return;
        }
        setCreatingNew(false);
        setNewName("");
      })
      .finally(() => setPending(false));
  }

  if (creatingNew) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] space-y-1.5">
          <Label htmlFor="new-move-category">Nom du nouveau dossier</Label>
          <Input
            id="new-move-category"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={80}
            disabled={isPending}
            placeholder="ex : Phase 0 — prise de contact"
            autoFocus
          />
        </div>
        <Button type="button" size="sm" disabled={isPending || newName.trim().length === 0} onClick={handleCreateAndMove}>
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
          Créer et ranger ici
        </Button>
        <button
          type="button"
          className="pb-2 text-xs text-gris-mid hover:underline"
          onClick={() => {
            setCreatingNew(false);
            setNewName("");
            setError(null);
          }}
        >
          Annuler
        </button>
        {error && (
          <p role="alert" className="flex w-full items-center gap-1 text-xs text-rouge-imp">
            <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[14rem] space-y-1.5">
        <Label htmlFor="move-category">Dossier</Label>
        <Select
          id="move-category"
          value={categoryId}
          disabled={isPending}
          onChange={(event) => handleSelectChange(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
          <option value={OTHER_VALUE}>Autre — créer un nouveau dossier…</option>
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
