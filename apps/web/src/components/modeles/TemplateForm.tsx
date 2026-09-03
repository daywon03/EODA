"use client";

import { useActionState, useState } from "react";
import { createTemplate, type CategorySummary } from "@/lib/actions/template-library";
import {
  TEMPLATE_KINDS,
  TEMPLATE_KIND_HINTS,
  TEMPLATE_KIND_LABELS,
} from "@/lib/services/template-library-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Plus } from "lucide-react";

// Création d'une fiche de modèle. La fiche ne porte AUCUN fichier : elle nomme un
// document, et les fichiers viennent ensuite. C'est ce qui permet de tenir « version
// vierge, version initiale, version finale » du même document au même endroit plutôt
// qu'en trois entrées sans lien entre elles.
//
// La NATURE se choisit ici et ne change plus : un gabarit a trois stades, un document
// de référence n'en a aucun. Basculer l'un en l'autre après coup rendrait des fichiers
// déjà déposés inatteignables — c'est pour ça que le choix est explicite, avec sa
// conséquence écrite à côté.
export function TemplateForm({ categories }: { categories: CategorySummary[] }) {
  const [state, formAction, isPending] = useActionState(createTemplate, null);
  const [kind, setKind] = useState<string>("GABARIT");

  if (categories.length === 0) {
    return (
      <p className="text-sm text-gris-mid">
        Créez d&apos;abord un dossier : une fiche se range forcément quelque part.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">
            Titre du modèle <span className="text-rouge-imp">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            placeholder="ex : Projet de service"
            maxLength={200}
            required
            disabled={isPending}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="categoryId">
            Dossier <span className="text-rouge-imp">*</span>
          </Label>
          <Select id="categoryId" name="categoryId" required disabled={isPending} defaultValue="">
            <option value="" disabled>
              — Sélectionner —
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="kind">
          Nature du document <span className="text-rouge-imp">*</span>
        </Label>
        <Select
          id="kind"
          name="kind"
          required
          disabled={isPending}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {TEMPLATE_KINDS.map((value) => (
            <option key={value} value={value}>
              {TEMPLATE_KIND_LABELS[value]}
            </option>
          ))}
        </Select>
        {/* La conséquence du choix, affichée au moment du choix : « document de
            référence » ne dit pas de lui-même qu'il n'aura ni stade ni version. */}
        <p className="text-xs text-gris-mid">
          {kind === "REFERENCE" ? TEMPLATE_KIND_HINTS.REFERENCE : TEMPLATE_KIND_HINTS.GABARIT}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">À quoi sert ce modèle</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={1000}
          placeholder="Quelques mots : à quel critère il répond, dans quel cas l'utiliser."
          disabled={isPending}
        />
      </div>

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Créer le modèle
      </Button>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
