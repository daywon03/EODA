"use client";

import { useActionState, useState } from "react";
import { createAppointment } from "@/lib/actions/appointment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, CalendarPlus, Loader2 } from "lucide-react";
import {
  APPOINTMENT_KIND_LABELS,
  APPOINTMENT_MODE_LABELS,
  PROSPECT_APPOINTMENT_KINDS,
} from "@/lib/services/calendar-service";
import type { AppointmentKind } from "@eoda/database";
import { Textarea } from "@/components/ui/textarea";

type Props =
  | { establishmentId: string; prospectId?: never; structureName: string }
  | { prospectId: string; establishmentId?: never; structureName: string };

// Le formulaire s'adapte à ce qu'on programme : sur un prospect, seuls les trois
// rendez-vous de vente (R0, R1, R2) ; sur un client, ceux de l'accompagnement. Une
// liste unique de neuf entrées ferait chercher à chaque fois.
function kindsFor(isProspect: boolean): AppointmentKind[] {
  const all = Object.keys(APPOINTMENT_KIND_LABELS) as AppointmentKind[];
  return isProspect
    ? PROSPECT_APPOINTMENT_KINDS
    : all.filter((kind) => !PROSPECT_APPOINTMENT_KINDS.includes(kind));
}

const HELP_BY_MODE: Record<string, string> = {
  VISIO: "Collez le lien de la visioconférence — le client le verra sur son portail.",
  PRESENTIEL: "Indiquez l'adresse exacte : c'est ce que le client lira avant de se déplacer.",
  TELEPHONE: "Indiquez le numéro à appeler, ou qui appelle qui.",
};

export function AppointmentForm(props: Props) {
  const isProspect = "prospectId" in props && !!props.prospectId;
  const [state, formAction, isPending] = useActionState(createAppointment, null);
  const [mode, setMode] = useState<string>("VISIO");

  return (
    <form action={formAction} className="space-y-4">
      {isProspect ? (
        <input type="hidden" name="prospectId" value={props.prospectId} />
      ) : (
        <input type="hidden" name="establishmentId" value={props.establishmentId} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="kind">
            Type de rendez-vous <span className="text-rouge-imp">*</span>
          </Label>
          <Select id="kind" name="kind" required disabled={isPending} defaultValue="">
            <option value="">— Sélectionner —</option>
            {kindsFor(isProspect).map((kind) => (
              <option key={kind} value={kind}>
                {APPOINTMENT_KIND_LABELS[kind]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mode">
            Format <span className="text-rouge-imp">*</span>
          </Label>
          <Select
            id="mode"
            name="mode"
            required
            disabled={isPending}
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            {Object.entries(APPOINTMENT_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subject">
          Intitulé <span className="text-rouge-imp">*</span>
        </Label>
        <Input
          id="subject"
          name="subject"
          required
          disabled={isPending}
          placeholder="ex : Atelier documentaire — jour 1"
        />
        <p className="text-xs text-gris-mid">Cet intitulé est lu par le client.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">
            Date <span className="text-rouge-imp">*</span>
          </Label>
          <Input id="date" name="date" type="date" required disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startTime">
            Début <span className="text-rouge-imp">*</span>
          </Label>
          <Input id="startTime" name="startTime" type="time" required disabled={isPending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">
            Fin <span className="text-rouge-imp">*</span>
          </Label>
          <Input id="endTime" name="endTime" type="time" required disabled={isPending} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location">Lieu ou lien</Label>
        <Input
          id="location"
          name="location"
          disabled={isPending}
          placeholder={mode === "VISIO" ? "https://meet.google.com/..." : "12 rue des Lilas, 93150 Le Blanc-Mesnil"}
        />
        {/* Aide persistante sous le champ, et non un placeholder qui disparaît à la
            première frappe. */}
        <p className="text-xs text-gris-mid">{HELP_BY_MODE[mode]}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes de préparation</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          disabled={isPending}
          placeholder="Points à aborder, documents à emporter..."
        />
        <p className="text-xs text-gris-mid">
          Ces notes restent internes au cabinet — le client ne les voit jamais.
        </p>
      </div>

      {state?.error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-md border border-rouge-imp/20 bg-rouge-imp/10 px-3 py-2.5 text-sm text-rouge-imp"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <CalendarPlus className="w-4 h-4" aria-hidden="true" />
          )}
          Programmer le rendez-vous
        </Button>
        <span className="text-xs text-gris-mid">
          Le créneau est enregistré comme <b>proposé</b> : confirmez-le une fois que la
          structure a validé.
        </span>
      </div>
    </form>
  );
}
