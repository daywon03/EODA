"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Tablet, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import { enrollThisDevice, revokeDevice, setStaffPin, setStaffTabletRole, unlockStaffPin, type TabletAdminView } from "@/lib/actions/tablet";
import { TABLET_ROLE_LABELS, TABLET_ROLES } from "@/lib/services/tablet-role-service";
import type { TabletRole } from "@eoda/database";
import { formatDate } from "@/lib/services/date-format-service";

// Tablettes et codes des intervenants (décision 7) : la direction enregistre CET
// appareil, pose un code de 6 chiffres par salarié et débloque un code après 5
// échecs. Le code saisi n'est jamais réaffiché.
type State = { error: string } | { ok: true } | null;

function useFormAction(action: (data: FormData) => Promise<State>) {
  const router = useRouter();
  return useActionState<State, FormData>(async (_previous, data) => {
    const result = await action(data);
    if (result && "ok" in result) router.refresh();
    return result;
  }, null);
}

function Feedback({ state, success }: { state: State; success: string }) {
  if (!state) return null;
  if ("error" in state) return <p role="alert" className="font-bold text-danger-text">{state.error}</p>;
  return <p role="status" className="font-bold text-ok-text">{success}</p>;
}

function PinForm({ establishmentId, staffId, name }: { establishmentId: string; staffId: string; name: string }) {
  const [state, formAction, isPending] = useFormAction(setStaffPin);
  return (
    <form method="post" onSubmit={submitWithoutReset(formAction)} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="establishmentId" value={establishmentId} />
      <input type="hidden" name="staffMemberId" value={staffId} />
      <label className="flex flex-col gap-1">
        <span className="font-bold">Nouveau code (6 chiffres)</span>
        <Input name="pin" inputMode="numeric" autoComplete="off" pattern="\d{6}" maxLength={6} required aria-label={`Nouveau code de ${name}`} className="w-40 tabular-nums" />
      </label>
      <Button type="submit" variant="outline" disabled={isPending}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Enregistrement…" : "Poser le code"}
      </Button>
      <Feedback state={state} success="Code enregistré. Donnez-le à la personne, il ne sera plus affiché." />
    </form>
  );
}

const PIN_LABEL = { AUCUN: "Pas de code", ACTIF: "Code actif", BLOQUE: "Code bloqué" } as const;

// Ce que ce salarié peut faire sur la tablette (30/10/2026) : l'intervenant fait
// signer et passe les enquêtes ; l'administrateur voit aussi les dossiers et exporte.
function TabletRoleSelect({ establishmentId, staffId, name, role }: { establishmentId: string; staffId: string; name: string; role: TabletRole }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <span className="flex flex-col gap-1">
      <select
        value={role}
        disabled={pending}
        aria-label={`Rôle de ${name} sur la tablette`}
        title={TABLET_ROLE_LABELS[role].description}
        className="h-11 rounded-md border border-line bg-card px-2 text-ink"
        onChange={(e) => {
          setError(null);
          setPending(true);
          const data = new FormData();
          data.set("establishmentId", establishmentId);
          data.set("staffMemberId", staffId);
          data.set("tabletRole", e.target.value);
          void setStaffTabletRole(data).then((result) => {
            setPending(false);
            if ("error" in result) setError(result.error);
            else router.refresh();
          });
        }}
      >
        {TABLET_ROLES.map((value) => (
          <option key={value} value={value}>
            {TABLET_ROLE_LABELS[value].label}
          </option>
        ))}
      </select>
      {error && <span role="alert" className="text-sm font-bold text-danger-text">{error}</span>}
    </span>
  );
}

export function TabletAdminPanel({ establishmentId, view }: { establishmentId: string; view: TabletAdminView }) {
  const [enrollState, enrollAction, enrolling] = useFormAction(enrollThisDevice);
  const [openPin, setOpenPin] = useState<string | null>(null);
  const router = useRouter();
  const thisDeviceEnrolled = view.devices.some((d) => d.isThisDevice);

  return (
    <section aria-labelledby="tablettes-titre" className="flex flex-col gap-5 rounded-xl border border-line bg-card p-5">
      <div>
        <h2 id="tablettes-titre" className="text-xl font-bold">Tablettes et codes des intervenants</h2>
        <p className="max-w-[70ch] text-ink2">
          Un intervenant se connecte sur une tablette enregistrée par la direction, avec son code personnel. Jamais un code seul :
          sur un autre appareil, le code n&apos;ouvre rien. Après 5 essais faux, le code se bloque.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Tablettes enregistrées</h3>
        {view.devices.length === 0 ? (
          <p className="text-ink2">Aucune tablette enregistrée.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {view.devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Tablet className="h-5 w-5 text-ink2" aria-hidden="true" />
                <span className="min-w-[10rem] flex-1 font-bold">
                  {device.label}
                  {device.isThisDevice && <span className="ml-2 font-normal text-ink2">(cet appareil)</span>}
                </span>
                <span className="text-ink2">depuis le {formatDate(device.enrolledAt)}</span>
                <ConfirmActionButton
                  label="Retirer"
                  accessibleLabel={`Retirer la tablette ${device.label}`}
                  question={`Retirer « ${device.label} » ? Plus personne ne pourra s'y connecter. Il faudra l'enregistrer à nouveau.`}
                  tone="destructive"
                  onConfirm={async () => {
                    const data = new FormData();
                    data.set("establishmentId", establishmentId);
                    data.set("deviceId", device.id);
                    const result = await revokeDevice(data);
                    if ("ok" in result) router.refresh();
                    return "error" in result ? result : null;
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {!thisDeviceEnrolled && (
          <form method="post" onSubmit={submitWithoutReset(enrollAction)} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="establishmentId" value={establishmentId} />
            <label className="flex flex-col gap-1">
              <span className="font-bold">Nom de cette tablette</span>
              <Input name="label" required maxLength={60} placeholder="Tablette du bureau" className="w-64" />
            </label>
            <Button type="submit" disabled={enrolling}>
              {enrolling ? "Enregistrement…" : "Enregistrer cet appareil"}
            </Button>
            <Feedback state={enrollState} success="Cet appareil est enregistré. Ouvrez /tablette pour s'y connecter." />
          </form>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Codes et rôles des salariés</h3>
        <p className="max-w-[70ch] text-ink2">
          <strong>Intervenant</strong> : {TABLET_ROLE_LABELS.INTERVENANT.description} <strong>Administrateur</strong> :{" "}
          {TABLET_ROLE_LABELS.ADMINISTRATEUR.description}
        </p>
        {view.staff.length === 0 ? (
          <p className="text-ink2">Ajoutez d&apos;abord l&apos;équipe dans « Mon équipe ».</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {view.staff.map((member) => (
              <li key={member.id} className="flex flex-col gap-2 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-[10rem] flex-1">
                    <span className="font-bold">{member.displayName}</span> <span className="text-ink2">· {member.jobTitle}</span>
                  </span>
                  {member.byDirection ? (
                    <span className="font-bold" title="La direction est toujours administrateur sur la tablette.">Administrateur (direction)</span>
                  ) : (
                    <TabletRoleSelect establishmentId={establishmentId} staffId={member.id} name={member.displayName} role={member.tabletRole} />
                  )}
                  <span className={member.pin === "BLOQUE" ? "font-bold text-danger-text" : "text-ink2"}>{PIN_LABEL[member.pin]}</span>
                  {member.pin === "BLOQUE" && (
                    <ConfirmActionButton
                      label="Débloquer"
                      icon={Unlock}
                      tone="neutral"
                      question={`Débloquer le code de ${member.displayName} ? Le compteur d'essais repart à zéro.`}
                      onConfirm={async () => {
                        const data = new FormData();
                        data.set("establishmentId", establishmentId);
                        data.set("staffMemberId", member.id);
                        const result = await unlockStaffPin(data);
                        if ("ok" in result) router.refresh();
                        return "error" in result ? result : null;
                      }}
                    />
                  )}
                  <Button type="button" variant="outline" onClick={() => setOpenPin(openPin === member.id ? null : member.id)} aria-expanded={openPin === member.id}>
                    {member.pin === "AUCUN" ? "Donner un code" : "Changer le code"}
                  </Button>
                </div>
                {openPin === member.id && <PinForm establishmentId={establishmentId} staffId={member.id} name={member.displayName} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
