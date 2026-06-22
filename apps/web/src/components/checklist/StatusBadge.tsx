import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@eoda/database";

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; variant: "missing" | "compliant" | "incomplete" | "analyzing" | "not_applicable" | "expired" | "default" }
> = {
  MISSING: { label: "Manquant", variant: "missing" },
  UPLOADED: { label: "Déposé", variant: "analyzing" },
  ANALYZING: { label: "En analyse…", variant: "analyzing" },
  INCOMPLETE: { label: "Incomplet", variant: "incomplete" },
  COMPLIANT: { label: "Conforme", variant: "compliant" },
  EXPIRED: { label: "Périmé", variant: "expired" },
  NOT_APPLICABLE: { label: "Non applicable", variant: "not_applicable" },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { label, variant } = STATUS_CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
