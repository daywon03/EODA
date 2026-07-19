import { Badge } from "@/components/ui/badge";
import type { ProspectStatus } from "@eoda/database";

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  NOUVEAU: "Nouveau contact",
  RDV: "RDV programmé",
  DEVIS_ENVOYE: "Devis envoyé",
  NEGOCIATION: "Négociation",
  SIGNE: "Signé",
  PERDU: "Perdu",
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
