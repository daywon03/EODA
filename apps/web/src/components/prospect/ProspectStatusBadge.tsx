import { Badge } from "@/components/ui/badge";
import type { ProspectStatus } from "@eoda/database";
import { FUNNEL_STAGE_LABELS } from "@/lib/services/lifecycle-service";

// Les six étapes du prospect sont les six premières de l'entonnoir, sous les MÊMES
// noms. Elles étaient écrites deux fois, ici et dans `FUNNEL_STAGE_LABELS` : deux
// tables de libellés du même fait finissent par diverger, et la divergence est
// invisible — le badge d'une fiche et la barre de l'entonnoir désignent alors la même
// étape sous deux noms, sans que rien ne le signale (D1).
//
// Le `Record<ProspectStatus, string>` reste explicite plutôt que dérivé par filtrage :
// il cesse de compiler si une valeur d'enum est ajoutée sans libellé, et c'est ce
// contrôle-là qui empêche une étape d'apparaître à l'écran sous son nom technique.
export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  NOUVEAU: FUNNEL_STAGE_LABELS.NOUVEAU,
  RDV: FUNNEL_STAGE_LABELS.RDV,
  DEVIS_ENVOYE: FUNNEL_STAGE_LABELS.DEVIS_ENVOYE,
  NEGOCIATION: FUNNEL_STAGE_LABELS.NEGOCIATION,
  SIGNE: FUNNEL_STAGE_LABELS.SIGNE,
  PERDU: FUNNEL_STAGE_LABELS.PERDU,
};

const PROSPECT_STATUS_VARIANTS: Record<ProspectStatus, "nouveau" | "rdv" | "devisEnvoye" | "negociation" | "signe" | "perdu"> = {
  NOUVEAU: "nouveau",
  RDV: "rdv",
  DEVIS_ENVOYE: "devisEnvoye",
  NEGOCIATION: "negociation",
  SIGNE: "signe",
  PERDU: "perdu",
};

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  return <Badge variant={PROSPECT_STATUS_VARIANTS[status]}>{PROSPECT_STATUS_LABELS[status]}</Badge>;
}
