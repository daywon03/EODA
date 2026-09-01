"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveDiscoveryAnswers } from "@/lib/actions/discovery";
import {
  discoveryCompletionPercent,
  type DiscoveryAnswers,
} from "@/lib/services/discovery-grid-service";
import type { DiscoveryGrid } from "@/content/decouverte/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Save } from "lucide-react";

type Props = {
  prospectId: string;
  grid: DiscoveryGrid;
  answers: DiscoveryAnswers;
  updatedAt: Date | null;
};

const TEXTAREA_CLASS =
  "w-full rounded-md border border-gris-light bg-white px-3 py-2 text-sm text-brun-ancre placeholder:text-gris-mid focus:outline-none focus:ring-2 focus:ring-terre/40 focus:border-terre disabled:opacity-60";

// Grille de découverte, saisie EN SÉANCE — mêmes partis pris que l'évaluation des
// besoins : une seule page, aucun assistant multi-étapes (on parle en même temps),
// un seul enregistrement, et aucun champ obligatoire. Une grille qui refuse d'être
// enregistrée à moitié se remplit après la réunion, de mémoire, ou pas du tout.
export function DiscoveryGridForm({ prospectId, grid, answers, updatedAt }: Props) {
  const [state, formAction, isPending] = useActionState(
    saveDiscoveryAnswers.bind(null, prospectId),
    null
  );

  const percent = discoveryCompletionPercent(answers, grid);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2 rounded-lg border border-gris-light bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-brun-ancre">Grille renseignée</span>
          <span className="tabular-nums text-gris-mid">{percent}%</span>
        </div>
        <ProgressBar value={percent} colorClassName="bg-ambre" />
        <p className="text-xs text-gris-mid">
          {updatedAt
            ? `Dernière saisie le ${updatedAt.toLocaleDateString("fr-FR")}`
            : "Aucune réponse enregistrée pour l'instant."}{" "}
          Gabarit {grid.version}.
        </p>
      </div>

      {grid.sections.map((section) => (
        <fieldset key={section.id} className="space-y-4 rounded-lg border border-gris-light bg-white p-5">
          <legend className="px-1">
            <span className="text-sm font-semibold text-brun-ancre">{section.title}</span>
          </legend>
          <p className="-mt-2 text-xs text-gris-mid">{section.purpose}</p>

          {section.fields.map((field) => {
            const value = answers[field.id] ?? "";
            return (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={field.id}>{field.label}</Label>

                {field.kind === "CHOICE" ? (
                  <Select id={field.id} name={field.id} defaultValue={value} disabled={isPending}>
                    <option value="">— Sans réponse —</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                ) : field.kind === "LONG_TEXT" ? (
                  <textarea
                    id={field.id}
                    name={field.id}
                    rows={3}
                    maxLength={2000}
                    defaultValue={value}
                    disabled={isPending}
                    className={TEXTAREA_CLASS}
                  />
                ) : (
                  <Input
                    id={field.id}
                    name={field.id}
                    defaultValue={value}
                    maxLength={300}
                    disabled={isPending}
                  />
                )}

                {field.hint && <p className="text-xs text-gris-mid">{field.hint}</p>}
              </div>
            );
          })}
        </fieldset>
      ))}

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      {state && "ok" in state && (
        <p className="flex items-center gap-2 text-sm text-vert-ok">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          Réponses enregistrées.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-gris-light pt-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          Enregistrer la grille
        </Button>

        {/* La suite du parcours, sur le même écran : découverte → évaluation des
            besoins → devis. La grille documente la conversation, elle ne coche
            aucune offre — c'est Sandrine qui coche (§12.3). */}
        <Button type="button" variant="outline" asChild>
          <Link href={`/dashboard/cabinet/commercial/prospects/${prospectId}/evaluation-besoins`}>
            Passer à l&apos;évaluation des besoins
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </form>
  );
}
