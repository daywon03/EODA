import type { AppointmentMode as Mode } from "@eoda/database";
import { Video, MapPin, Phone } from "lucide-react";
import { APPOINTMENT_MODE_LABELS } from "@/lib/services/calendar-service";

// Format d'un rendez-vous, rendu avec une icône EN PLUS du mot. Le STATUT (proposé,
// confirmé, annulé) est une StatusPill — glyphe + mot, vocabulaire unique dans
// lib/design/status-vocabulary.ts.

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
