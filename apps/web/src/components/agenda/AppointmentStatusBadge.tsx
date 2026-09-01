import type { AppointmentMode as Mode, AppointmentStatus } from "@eoda/database";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, CheckCircle2, XCircle, Video, MapPin, Phone } from "lucide-react";
import {
  APPOINTMENT_MODE_LABELS,
  APPOINTMENT_STATUS_LABELS,
} from "@/lib/services/calendar-service";

// Statut ET format d'un rendez-vous, toujours rendus avec une icône EN PLUS de la
// couleur : un créneau « proposé » et un créneau « confirmé » ne doivent pas se
// distinguer par la seule teinte — c'est la règle d'accessibilité la plus souvent
// oubliée, et ici elle décide si quelqu'un se déplace ou non.

const STATUS_ICONS: Record<AppointmentStatus, typeof CalendarClock> = {
  PROPOSE: CalendarClock,
  CONFIRME: CheckCircle2,
  ANNULE: XCircle,
};

const STATUS_VARIANTS: Record<AppointmentStatus, "secondary" | "compliant" | "missing"> = {
  PROPOSE: "secondary",
  CONFIRME: "compliant",
  ANNULE: "missing",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge variant={STATUS_VARIANTS[status]} className="gap-1">
      <Icon className="w-3 h-3" aria-hidden="true" />
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

const MODE_ICONS: Record<Mode, typeof Video> = {
  VISIO: Video,
  PRESENTIEL: MapPin,
  TELEPHONE: Phone,
};

// Le format se lit d'un coup d'œil : c'est ce qui dit s'il faut prendre la route.
export function AppointmentMode({ mode, location }: { mode: Mode; location: string | null }) {
  const Icon = MODE_ICONS[mode];
  const isLink = mode === "VISIO" && !!location && /^https?:\/\//.test(location);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gris-mid">
      <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      <span>{APPOINTMENT_MODE_LABELS[mode]}</span>
      {location && (
        <>
          <span aria-hidden="true">·</span>
          {isLink ? (
            <a
              href={location}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terre underline underline-offset-2 hover:text-brun-moyen transition-colors"
            >
              Rejoindre la visio
            </a>
          ) : (
            <span className="truncate">{location}</span>
          )}
        </>
      )}
    </span>
  );
}
