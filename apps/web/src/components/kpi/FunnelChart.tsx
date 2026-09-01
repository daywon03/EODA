import { AlertTriangle, ArrowDown } from "lucide-react";
import { FUNNEL_STAGE_LABELS } from "@/lib/services/lifecycle-service";
import {
  biggestDropStage,
  describeFunnel,
  type FunnelStep,
} from "@/lib/services/funnel-view-service";

type Props = {
  steps: FunnelStep[];
  lost: number;
  indetermine: number;
};

// Entonnoir commercial — barres proportionnelles + taux de passage entre étapes.
//
// Ce n'est pas un graphique au sens « canvas » : c'est une LISTE de barres en CSS.
// Choix délibéré, et c'est ce que recommande la règle `data-table` / `a11y-fallback`
// pour un entonnoir — chaque étape reste du texte lisible par un lecteur d'écran, la
// barre n'est qu'un renfort visuel. Aucune information n'est portée par la seule
// couleur (`color-not-only`) : le nombre et le pourcentage sont écrits.
//
// Tout le calcul vit dans `funnel-view-service` (pur, testé). Ici, on rend.
export function FunnelChart({ steps, lost, indetermine }: Props) {
  const worstStage = biggestDropStage(steps);

  return (
    <section className="rounded-xl border border-gris-light bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-brun-ancre">Entonnoir commercial</h3>
        <p className="mt-0.5 text-xs text-gris-mid">{describeFunnel({ steps, lost, indetermine })}</p>
      </div>

      <ol className="space-y-1">
        {steps.map((step, index) => {
          const isWorst = step.stage === worstStage;
          return (
            <li key={step.stage}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-brun-ancre">
                  {FUNNEL_STAGE_LABELS[step.stage]}
                </span>
                <span className="flex-shrink-0 text-xs text-gris-mid tabular-nums">
                  <span className="font-semibold text-brun-ancre">{step.reached}</span>
                  {" · "}
                  {step.sharePercent}%
                  {/* « Actuellement à cette étape » n'est pas la même chose que
                      « a atteint cette étape » : la nuance est affichée, sinon la
                      barre se lit comme un stock. Rien quand personne n'y est —
                      « 0 ici » sur chaque ligne franchie n'apprend rien et remplit
                      la place. */}
                  {step.current > 0 && step.current !== step.reached && (
                    <span className="text-gris-mid"> · {step.current} à cette étape</span>
                  )}
                </span>
              </div>

              {/* Barre : largeur en part de l'entrée. `min-width` pour qu'une étape
                  non vide reste visible — une barre de 1 px se lit comme zéro. */}
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ivoire">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
                    isWorst ? "bg-terre" : "bg-brun-moyen/70"
                  }`}
                  style={{
                    width: step.reached === 0 ? "0%" : `max(4px, ${step.sharePercent}%)`,
                  }}
                />
              </div>

              {/* Décrochage vers l'étape suivante. C'est LA lecture utile de
                  l'entonnoir, donc elle est écrite entre les barres et pas déduite
                  de leur différence de longueur. */}
              {step.passRatePercent !== null && index < steps.length - 1 && (
                <p
                  className={`mt-1 flex items-center gap-1 pl-0.5 text-[11px] ${
                    isWorst ? "font-medium text-terre" : "text-gris-mid"
                  }`}
                >
                  <ArrowDown className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                  {step.passRatePercent}% passent à l&apos;étape suivante
                  {step.dropCount > 0 && ` · ${step.dropCount} sortie${step.dropCount > 1 ? "s" : ""}`}
                  {isWorst && " · plus forte perte"}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {lost > 0 && (
        <p className="mt-4 flex items-start gap-2 border-t border-gris-light pt-3 text-xs text-gris-mid">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ambre" aria-hidden="true" />
          {lost} affaire{lost > 1 ? "s" : ""} perdue{lost > 1 ? "s" : ""} — comptée
          {lost > 1 ? "s" : ""} à part : l&apos;étape à laquelle elle
          {lost > 1 ? "s se sont" : " s'est"} arrêtée{lost > 1 ? "s" : ""} n&apos;est pas
          enregistrée, la répartir serait une invention.
        </p>
      )}
    </section>
  );
}
