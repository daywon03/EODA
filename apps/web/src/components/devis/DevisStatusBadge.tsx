import { Badge } from "@/components/ui/badge";
import type { DevisStatus } from "@eoda/database";

export const DEVIS_STATUS_LABELS: Record<DevisStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  SIGNE: "Signé",
  REFUSE: "Refusé",
};

const DEVIS_STATUS_VARIANTS: Record<DevisStatus, "brouillon" | "devisEnvoye" | "signe" | "perdu"> = {
  BROUILLON: "brouillon",
  ENVOYE: "devisEnvoye",
  SIGNE: "signe",
  REFUSE: "perdu",
};

export function DevisStatusBadge({ status }: { status: DevisStatus }) {
  return <Badge variant={DEVIS_STATUS_VARIANTS[status]}>{DEVIS_STATUS_LABELS[status]}</Badge>;
}
