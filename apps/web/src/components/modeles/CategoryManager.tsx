"use client";

import { useActionState, useState } from "react";
import {
  createTemplateCategory,
  deleteTemplateCategory,
  moveTemplateCategory,
  renameTemplateCategory,
  type CategorySummary,
} from "@/lib/actions/template-library";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";
import { AlertCircle, ArrowDown, ArrowUp, Check, FolderPlus, Loader2, Pencil, Trash2 } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// LES DOSSIERS DE LA BIBLIOTHÈQUE
//
// « Il faudrait que tu puisses au moins rajouter toi-même à la main » (call du
// 03/09) : Sandrine voulait ranger un gabarit dans « Phase 0 — prise de contact »,
// une étape de son mode opératoire qui n'existe dans aucun référentiel documentaire.
//
// L'ordre se règle à la main et pas alphabétiquement : ses dossiers suivent le déroulé
// d'une mission, et un tri alphabétique mettrait « Phase 10 » avant « Phase 2 ».
// ─────────────────────────────────────────────────────────────────────────────
export function CategoryManager({ categories }: { categories: CategorySummary[] }) {
  const [state, formAction, isPending] = useActionState(createTemplateCategory, null);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label htmlFor="new-category">Nom du dossier</Label>
          <Input
            id="new-category"
            name="name"
            placeholder="ex : Phase 0 — prise de contact"
            maxLength={80}
            required
            disabled={isPending}
          />
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Créer le dossier
        </Button>
      </form>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <ul className="divide-y divide-gris-light">
        {categories.map((category, index) => (
          <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            {editing === category.id ? (
              <RenameForm
                category={category}
                onDone={() => setEditing(null)}
              />
            ) : (
              <>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brun-ancre">{category.name}</p>
                  <p className="text-xs text-gris-mid">
                    {category.templateCount} modèle{category.templateCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  {/* Les flèches sont désactivées en bout de liste plutôt que
                      masquées : un bouton qui disparaît décale les autres, et on
                      clique sur le mauvais. */}
                  <MoveButton
                    categoryId={category.id}
                    direction="up"
                    disabled={index === 0}
                    name={category.name}
                  />
                  <MoveButton
                    categoryId={category.id}
                    direction="down"
                    disabled={index === categories.length - 1}
                    name={category.name}
                  />
                  <button
                    type="button"
                    className={INLINE_ACTION_CLASS}
                    onClick={() => setEditing(category.id)}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Renommer {category.name}</span>
                    Renommer
                  </button>
                  <ConfirmActionButton
                    appearance="link"
                    label="Supprimer"
                    accessibleLabel={`Supprimer le dossier ${category.name}`}
                    icon={Trash2}
                    question={`Supprimer le dossier « ${category.name} » ?`}
                    confirmLabel="Supprimer le dossier"
                    disabled={category.templateCount > 0}
                    onConfirm={() => deleteTemplateCategory(category.id)}
                  />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MoveButton({
  categoryId,
  direction,
  disabled,
  name,
}: {
  categoryId: string;
  direction: "up" | "down";
  disabled: boolean;
  name: string;
}) {
  const [isPending, setPending] = useState(false);
  const Icon = direction === "up" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      className={INLINE_ACTION_CLASS}
      disabled={disabled || isPending}
      onClick={() => {
        setPending(true);
        void moveTemplateCategory(categoryId, direction).finally(() => setPending(false));
      }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">
        Déplacer {name} vers le {direction === "up" ? "haut" : "bas"}
      </span>
    </button>
  );
}

function RenameForm({ category, onDone }: { category: CategorySummary; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await renameTemplateCategory(category.id, prev, formData);
      // On ne referme qu'en cas de succès : sur refus, le nom saisi doit rester à
      // l'écran pour être corrigé plutôt que retapé.
      if (!result) onDone();
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="flex w-full flex-wrap items-center gap-2">
      <Input
        name="name"
        defaultValue={category.name}
        aria-label={`Nouveau nom du dossier ${category.name}`}
        maxLength={80}
        required
        disabled={isPending}
        className="h-9 max-w-xs text-sm"
      />
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Enregistrer
      </Button>
      <button type="button" className={INLINE_ACTION_CLASS} onClick={onDone}>
        Annuler
      </button>
      {state && "error" in state && (
        <p role="alert" className="w-full text-xs text-rouge-imp">
          {state.error}
        </p>
      )}
    </form>
  );
}
