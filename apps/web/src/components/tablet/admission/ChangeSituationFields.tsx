"use client";

import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_ACTIVE_SERVICES,
  MAX_STOPPED_SERVICES,
  type ActiveService,
  type NewServiceMode,
  type StoppedService,
} from "@/lib/services/departement-change-form-service";
import { TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_INPUT, TABLET_SECONDARY } from "../tablet-ui";

// Ce qui change pour la personne (formulaire « changement de situation » du
// Département 93) : arrêt d'un service, nouveau service, nombre d'heures. Les deux
// tableaux du formulaire officiel, saisis tels quels.

const CHOICE = "min-h-[60px] rounded-xl border-2 px-4 py-2 text-left text-[19px]";
const LABEL = "flex flex-col gap-1.5 text-[18px] font-bold";
const EMPTY_STOPPED: StoppedService = { name: "", address: "", endDate: "" };
const EMPTY_ACTIVE: ActiveService = { name: "", address: "", date: "", weekdayHours: "", sundayHours: "" };

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={cn(CHOICE, on ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
      {children}
    </button>
  );
}

export function ChangeSituationFields({ stopped, newService, hoursChange, services, onStopped, onNewService, onHoursChange, onServices }: {
  stopped: StoppedService[];
  newService: NewServiceMode;
  hoursChange: boolean;
  services: ActiveService[];
  onStopped: (next: StoppedService[]) => void;
  onNewService: (next: NewServiceMode) => void;
  onHoursChange: (next: boolean) => void;
  onServices: (next: ActiveService[]) => void;
}) {
  const setStopped = (i: number, patch: Partial<StoppedService>) => onStopped(stopped.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setService = (i: number, patch: Partial<ActiveService>) => onServices(services.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="changement-quoi" className="flex flex-col gap-2.5">
        <h2 id="changement-quoi" className="text-[24px] font-bold">Ce qui change</h2>
        <Toggle on={stopped.length > 0} onClick={() => onStopped(stopped.length > 0 ? [] : [EMPTY_STOPPED])}>
          Un ou des services arrêtent d&apos;intervenir
        </Toggle>
        <Toggle on={newService !== ""} onClick={() => onNewService(newService ? "" : "A_LA_PLACE")}>
          Un nouveau service intervient
        </Toggle>
        {newService && (
          <div className="ml-6 flex flex-wrap gap-3">
            <Toggle on={newService === "A_LA_PLACE"} onClick={() => onNewService("A_LA_PLACE")}>à la place des services déjà désignés</Toggle>
            <Toggle on={newService === "EN_COMPLEMENT"} onClick={() => onNewService("EN_COMPLEMENT")}>en complément</Toggle>
          </div>
        )}
        <Toggle on={hoursChange} onClick={() => onHoursChange(!hoursChange)}>
          Le nombre d&apos;heures change
        </Toggle>
      </section>

      {stopped.length > 0 && (
        <section aria-labelledby="changement-arret" className="flex flex-col gap-4">
          <h2 id="changement-arret" className="text-[22px] font-bold">Services qui n&apos;interviendront plus</h2>
          {stopped.map((s, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2">
              <label className={LABEL}>Nom du service<input value={s.name} onChange={(e) => setStopped(i, { name: e.target.value })} className={TABLET_INPUT} maxLength={120} /></label>
              <label className={LABEL}>Date de fin<input type="date" value={s.endDate} onChange={(e) => setStopped(i, { endDate: e.target.value })} className={TABLET_INPUT} /></label>
              <label className={cn(LABEL, "sm:col-span-2")}>Adresse<input value={s.address} onChange={(e) => setStopped(i, { address: e.target.value })} className={TABLET_INPUT} maxLength={120} /></label>
            </div>
          ))}
          {stopped.length < MAX_STOPPED_SERVICES && (
            <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={() => onStopped([...stopped, EMPTY_STOPPED])}>
              <Plus className="h-5 w-5" aria-hidden="true" />
              Un autre service arrêté
            </button>
          )}
        </section>
      )}

      {(newService !== "" || hoursChange) && (
        <section aria-labelledby="changement-services" className="flex flex-col gap-4">
          <h2 id="changement-services" className="text-[22px] font-bold">Tous les services qui interviennent au domicile</h2>
          {services.map((s, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-line bg-card p-4 sm:grid-cols-2">
              <label className={LABEL}>Nom du service<input value={s.name} onChange={(e) => setService(i, { name: e.target.value })} className={TABLET_INPUT} maxLength={120} /></label>
              <label className={LABEL}>Date de début ou d&apos;effet<input type="date" value={s.date} onChange={(e) => setService(i, { date: e.target.value })} className={TABLET_INPUT} /></label>
              <label className={cn(LABEL, "sm:col-span-2")}>Adresse<input value={s.address} onChange={(e) => setService(i, { address: e.target.value })} className={TABLET_INPUT} maxLength={120} /></label>
              <label className={LABEL}>Heures par mois en semaine<input value={s.weekdayHours} onChange={(e) => setService(i, { weekdayHours: e.target.value })} className={TABLET_INPUT} inputMode="decimal" maxLength={10} /></label>
              <label className={LABEL}>Heures par mois le dimanche<input value={s.sundayHours} onChange={(e) => setService(i, { sundayHours: e.target.value })} className={TABLET_INPUT} inputMode="decimal" maxLength={10} /></label>
              {i > 0 && (
                <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={() => onServices(services.filter((_, j) => j !== i))}>
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                  Retirer ce service
                </button>
              )}
            </div>
          ))}
          {services.length < MAX_ACTIVE_SERVICES && (
            <button type="button" className={cn(TABLET_SECONDARY, "w-fit")} onClick={() => onServices([...services, EMPTY_ACTIVE])}>
              <Plus className="h-5 w-5" aria-hidden="true" />
              Un autre service
            </button>
          )}
        </section>
      )}
    </div>
  );
}
