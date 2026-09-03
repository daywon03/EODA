"use client";

import { useActionState } from "react";
import { createTemplate } from "@/lib/actions/template-library";
import { TEMPLATE_CATEGORY_LABELS } from "@/lib/services/template-library-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Plus } from "lucide-react";

// Création d'une fiche de modèle. La fiche ne porte AUCUN fichier : elle nomme un
// document, et les fichiers viennent ensuite, un par version. C'est ce qui permet de
// tenir « version vierge, version initiale, version finale » du même document au même
// endroit plutôt qu'en trois entrées sans lien entre elles.
export function TemplateForm() {
  const [state, formAction, isPending] = useActionState(createTemplate, null);

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
          <Label htmlFor="category">
            Catégorie <span className="text-rouge-imp">*</span>
          </Label>
          <Select id="category" name="category" required disabled={isPending} defaultValue="">
            <option value="" disabled>
              — Sélectionner —
            </option>
            <option value="LOI_2002_2">{TEMPLATE_CATEGORY_LABELS.LOI_2002_2}</option>
            <option value="FONCTIONNEMENT">{TEMPLATE_CATEGORY_LABELS.FONCTIONNEMENT}</option>
            <option value="QUALITE_RISQUES">{TEMPLATE_CATEGORY_LABELS.QUALITE_RISQUES}</option>
            <option value="RH">{TEMPLATE_CATEGORY_LABELS.RH}</option>
          </Select>
        </div>
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
