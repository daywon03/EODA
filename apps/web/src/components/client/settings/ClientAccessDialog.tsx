"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { SetupLinkPanel } from "@/components/ui/temporary-password-panel";
import { RoleCardPicker } from "@/components/team/RoleCardPicker";
import { CLIENT_ACCESS_ROLES, CLIENT_ACCESS_ROLE_LABELS, type ClientAccessRole } from "@/lib/auth/capabilities";
import { FUNCTION_LABELS } from "@/lib/services/action-item-service";
import {
  changeClientAccessRole,
  grantClientAccess,
  revokeClientAccess,
  type GrantClientAccessResult,
  type StructureAccessRow,
} from "@/lib/actions/client-access";

// « + Donner un accès » et « Rôle ✎ » de la page Paramètres (maquette A8). La
// direction choisit le rôle en cartes ; le poste (directeur, coordinatrice…) est
// une autre information, demandée à part. Tout est revérifié côté serveur.
type Props = { mode: "grant" } | { mode: "edit"; row: StructureAccessRow };

const ROLE_OPTIONS = CLIENT_ACCESS_ROLES.map((role) => ({ value: role, ...CLIENT_ACCESS_ROLE_LABELS[role] }));

export function ClientAccessDialog(props: Props) {
  const router = useRouter();
  const row = props.mode === "edit" ? props.row : null;
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ClientAccessRole>(row?.accessRole ?? "INTERVENANT");
  const [error, setError] = useState<string | null>(null);
  const [granted, setGranted] = useState<Extract<GrantClientAccessResult, { success: true }> | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setGranted(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("accessRole", role);
    setError(null);
    startTransition(async () => {
      if (!row) {
        const result = await grantClientAccess(data);
        if ("error" in result) return setError(result.error);
        setGranted(result);
        router.refresh();
        return;
      }
      data.set("userId", row.userId);
      const result = await changeClientAccessRole(data);
      if (result) return setError(result.error);
      close();
      router.refresh();
    });
  }

  return (
    <>
      {row ? (
        <Button
          variant="outline"
          className="h-12 text-[16px]"
          onClick={() => setOpen(true)}
          aria-label={`Changer le rôle de ${row.name} (${CLIENT_ACCESS_ROLE_LABELS[row.accessRole].label})`}
        >
          {CLIENT_ACCESS_ROLE_LABELS[row.accessRole].label}
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button className="h-12 text-[16px]" onClick={() => setOpen(true)}>
          <UserPlus className="h-5 w-5" aria-hidden="true" />
          Donner un accès
        </Button>
      )}

      {open && (
        <Modal title={row ? `Rôle de ${row.name}` : "Donner un accès à l’espace"} onClose={close} maxWidthClassName="max-w-2xl">
          <div className="overflow-y-auto p-5 text-[17px]">
            {granted ? (
              <div className="space-y-4">
                <SetupLinkPanel {...granted} />
                <Button variant="outline" onClick={close}>
                  Fermer
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                {!row && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="access-name">Nom</Label>
                      <Input id="access-name" name="name" required autoComplete="off" disabled={isPending} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="access-email">E-mail</Label>
                      <Input id="access-email" name="email" type="email" required autoComplete="off" disabled={isPending} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="access-job">Poste</Label>
                      <Select id="access-job" name="roleInEstablishment" required defaultValue="" disabled={isPending}>
                        <option value="" disabled>
                          Choisir le poste
                        </option>
                        {Object.entries(FUNCTION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}

                <RoleCardPicker
                  legend="Rôle dans l’espace"
                  name="access-role"
                  options={ROLE_OPTIONS}
                  value={role}
                  onChange={setRole}
                  disabled={isPending}
                />

                {error && (
                  <p role="alert" className="font-bold text-rouge-imp">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  {row && (
                    <ConfirmActionButton
                      label="Retirer l'accès"
                      icon={UserMinus}
                      question={`Retirer l'accès de ${row.name} ? La personne ne pourra plus entrer. Rien n'est supprimé : l'historique reste.`}
                      confirmLabel="Retirer l'accès"
                      onConfirm={async () => {
                        const result = await revokeClientAccess(row.userId);
                        if (!result) {
                          close();
                          router.refresh();
                        }
                        return result;
                      }}
                    />
                  )}
                  <Button type="submit" className="h-12 flex-1 text-[17px]" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {row ? "Enregistrer" : "Envoyer l’invitation"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
