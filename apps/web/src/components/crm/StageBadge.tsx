import { Badge } from "@/components/ui/badge";
import { FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/services/lifecycle-service";

// Couleurs de l'échelle commerciale. Le vert est réservé à « signé » — le moment où
// la vente est acquise ; « en cours » est neutre parce qu'un accompagnement qui
// avance n'est ni un succès ni une alerte, et « terminé » est sourd pour ne pas
// concurrencer visuellement les fiches actives dans une liste.
const STAGE_VARIANTS: Record<FunnelStage, string> = {
  NOUVEAU: "bg-gris-light text-brun-ancre",
  RDV: "bg-ambre/20 text-brun-ancre",
  DEVIS_ENVOYE: "bg-ambre/30 text-brun-ancre",
  NEGOCIATION: "bg-terre/20 text-brun-ancre",
  SIGNE: "bg-vert-ok/15 text-vert-ok",
  EN_COURS: "bg-terre/15 text-terre",
  TERMINE: "bg-gris-light text-gris-mid",
  PERDU: "bg-rouge-imp/10 text-rouge-imp",
};

// `stage` peut être null : une fiche sans mission ni prospect ne se voit attribuer
// aucune étape plutôt qu'une étape inventée (cf. lifecycle-service). On n'affiche
// alors rien — un badge « inconnu » ne renseigne personne.
export function StageBadge({ stage, beta }: { stage: FunnelStage | null; beta?: boolean }) {
  if (!stage && !beta) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {stage && (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_VARIANTS[stage]}`}
        >
          {FUNNEL_STAGE_LABELS[stage]}
        </span>
      )}
      {/* Badge SÉPARÉ, jamais une valeur de l'échelle : un bêta-test peut être signé,
          en cours ou terminé. Le fondre dans l'étape ferait disparaître l'information
          dès que la mission avance. */}
      {beta && <Badge variant="secondary">Bêta-test gratuit</Badge>}
    </span>
  );
}
