import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { pillForFunnelStage } from "@/lib/design/status-vocabulary";
import type { FunnelStage } from "@/lib/services/lifecycle-service";

// Étape d'une fiche + mention bêta-test. L'étape est une StatusPill (vocabulaire
// unique, lib/design/status-vocabulary.ts) ; ce composant ne garde que la règle
// d'assemblage, partagée par la liste et la fiche.
//
// `stage` peut être null : une fiche sans mission ni prospect ne se voit attribuer
// aucune étape plutôt qu'une étape inventée (cf. lifecycle-service). On n'affiche
// alors rien — une pastille « inconnu » ne renseigne personne.
export function StageBadge({ stage, beta }: { stage: FunnelStage | null; beta?: boolean }) {
  if (!stage && !beta) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {stage && <StatusPill pill={pillForFunnelStage(stage)} />}
      {/* Étiquette SÉPARÉE, jamais une valeur de l'échelle : un bêta-test peut être
          signé, en cours ou terminé. Le fondre dans l'étape ferait disparaître
          l'information dès que la mission avance. */}
      {beta && <Badge variant="secondary">Bêta-test gratuit</Badge>}
    </span>
  );
}
