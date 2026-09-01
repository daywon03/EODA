import { Check, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/services/date-format-service";
import type { RecapStep } from "@/lib/services/prospect-recap-service";

type Props = { steps: readonly RecapStep[]; closed: boolean };

// Récapitulatif de dossier — ce qui a DÉJÀ eu lieu, en haut de fiche.
//
// « Je vois que j'ai déjà envoyé le devis en un seul coup d'œil, sans aller trop
// chercher, faire monter, faire descendre » (call du 01/09). Il est donc placé avant
// tout le reste et tient sur une bande, sans défilement.
//
// Les étapes non franchies restent AFFICHÉES, en gris : voir le chemin entier dit où
// l'on s'est arrêté. Ne montrer que ce qui est fait obligerait à se rappeler ce qui
// vient après, ce qui est exactement le travail qu'on veut lui retirer.
export function ProspectRecap({ steps, closed }: Props) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-gris-mid">Où en est ce dossier</p>
          {closed && <span className="text-xs text-gris-mid">Affaire perdue — historique conservé</span>}
        </div>

        {/* Une colonne par étape à partir de la tablette, empilé en dessous : cinq
            étapes ne tiennent pas côte à côte sur un téléphone sans devenir
            illisibles, et une bande qui défile latéralement se lit encore moins bien
            qu'une liste. */}
        <ol className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2">
              {step.done ? (
                <Check
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-vert-ok"
                  aria-hidden="true"
                />
              ) : (
                <Circle
                  className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gris-light"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                {/* L'état ne repose pas que sur la couleur de l'icône : le texte
                    change de graisse, et les lecteurs d'écran l'entendent. */}
                <p
                  className={
                    step.done
                      ? "text-sm font-medium leading-snug text-brun-ancre"
                      : "text-sm leading-snug text-gris-mid"
                  }
                >
                  {step.label}
                  <span className="sr-only">{step.done ? " — fait" : " — pas encore"}</span>
                </p>
                {(step.at || step.detail) && (
                  <p className="text-xs text-gris-mid">
                    {step.at ? formatDate(step.at) : step.detail}
                    {step.at && step.detail ? ` · ${step.detail}` : ""}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
