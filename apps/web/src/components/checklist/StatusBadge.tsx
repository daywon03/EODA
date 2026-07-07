import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, FileWarning, MinusCircle, Loader2 } from "lucide-react";
import type { DocumentStatus } from "@eoda/database";

const STATUS_CONFIG: Record<
  DocumentStatus,
  {
    label: string;
    variant: "missing" | "compliant" | "incomplete" | "analyzing" | "not_applicable" | "expired" | "default";
    icon: typeof AlertCircle;
  }
> = {
  MISSING: { label: "Manquant", variant: "missing", icon: AlertCircle },
  UPLOADED: { label: "Déposé", variant: "analyzing", icon: Clock },
  ANALYZING: { label: "En analyse…", variant: "analyzing", icon: Loader2 },
  INCOMPLETE: { label: "Incomplet", variant: "incomplete", icon: FileWarning },
  COMPLIANT: { label: "Conforme", variant: "compliant", icon: CheckCircle2 },
  EXPIRED: { label: "Périmé", variant: "expired", icon: AlertCircle },
  NOT_APPLICABLE: { label: "Non applicable", variant: "not_applicable", icon: MinusCircle },
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { label, variant, icon: Icon } = STATUS_CONFIG[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={`w-3 h-3 flex-shrink-0 ${status === "ANALYZING" ? "animate-spin" : ""}`} aria-hidden="true" />
      {label}
    </Badge>
  );
}
