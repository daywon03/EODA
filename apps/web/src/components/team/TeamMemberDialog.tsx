"use client";

import { useState, useTransition } from "react";
import { Callout } from "@/components/ui/callout";
import { assignmentScopeNotice } from "@/lib/services/cabinet-team-service";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { TemporaryPasswordPanel } from "@/components/ui/temporary-password-panel";
import { CABINET_ROLES, CABINET_ROLE_LABELS, type CabinetRole } from "@/lib/auth/capabilities";
import {
  inviteCabinetMember,
  removeCabinetMemberAccess,
  updateCabinetMember,
  type CabinetTeamMember,
  type InviteCabinetMemberResult,
} from "@/lib/actions/cabinet-team";
import { RoleCardPicker } from "./RoleCardPicker";

// Modale « Inviter une personne » / « Modifier » de la maquette Équipe EODA. Le
// rôle se choisit en cartes (radio natifs : clavier et lecteur d'écran compris), les
// structures suivies n'apparaissent que pour une consultante — c'est le seul rôle
// que l'affectation restreint. Tout est revérifié côté serveur (cabinet-team.ts).
type Props = {
  establishments: { id: string; name: string }[];
} & ({ mode: "invite" } | { mode: "edit"; member: CabinetTeamMember; isSelf: boolean });

const ROLE_OPTIONS = CABINET_ROLES.map((role) => ({ value: role, ...CABINET_ROLE_LABELS[role] }));

export function TeamMemberDialog(props: Props) {
  const router = useRouter();
  const editing = props.mode === "edit" ? props.member : null;
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<CabinetRole>(editing?.role ?? "CABINET_EVALUATOR");
  const [structures, setStructures] = useState<string[]>(editing?.assignedEstablishmentIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [invited, setInvited] = useState<Extract<InviteCabinetMemberResult, { success: true }> | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setError(null);
    setInvited(null);
  }

  function toggleStructure(id: string) {
    setStructures((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("role", role);
    data.delete("establishmentIds");
    if (role === "CABINET_EVALUATOR") for (const id of structures) data.append("establishmentIds", id);
    setError(null);
    startTransition(async () => {
      if (!editing) {
        const result = await inviteCabinetMember(data);
        if ("error" in result) return setError(result.error);
        setInvited(result);
        router.refresh();
        return;
      }
      data.set("userId", editing.id);
      const result = await updateCabinetMember(data);
      if (result) return setError(result.error);
      close();
      router.refresh();
    });
  }

  const title = editing ? `Modifier : ${editing.name}` : "Inviter une personne dans l’équipe EODA";

  return (
    <>
      {editing ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-label={`Modifier ${editing.name}`}>
          {CABINET_ROLE_LABELS[editing.role].label}
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Inviter une personne
        </Button>
      )}

      {open && (
        <Modal title={title} onClose={close} maxWidthClassName="max-w-2xl">
          <div className="overflow-y-auto p-5">
            {invited ? (
              <div className="space-y-4">
                <TemporaryPasswordPanel {...invited} />
                <Button variant="outline" onClick={close}>
                  Fermer
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                {!editing && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="team-name">Nom</Label>
                      <Input id="team-name" name="name" required autoComplete="name" disabled={isPending} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="team-email">E-mail</Label>
                      <Input id="team-email" name="email" type="email" required autoComplete="email" disabled={isPending} />
                    </div>
                  </div>
                )}

                <RoleCardPicker
                  legend="Rôle"
                  name="role-choice"
                  options={ROLE_OPTIONS}
                  value={role}
                  onChange={(value) => setRole(value)}
                  disabled={isPending || (props.mode === "edit" && props.isSelf)}
                />
                {props.mode === "edit" && props.isSelf && (
                  <p className="text-ink2">Votre propre rôle ne se change pas depuis votre compte.</p>
                )}

                {role === "CABINET_EVALUATOR" && (
                  <fieldset className="space-y-2">
                    <legend className="font-bold text-ink">Structures suivies</legend>
                    {(() => {
                      const notice = assignmentScopeNotice(role, structures.length);
                      return notice ? (
                        <Callout tone={notice.tone} role="note">
                          {notice.text}
                        </Callout>
                      ) : null;
                    })()}
                    <div className="flex flex-wrap gap-2">
                      {props.establishments.map((establishment) => {
                        const checked = structures.includes(establishment.id);
                        return (
                          <label
                            key={establishment.id}
                            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-3 font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                              checked ? "border-ink bg-ink-fill text-on-ink" : "border-line bg-card text-ink"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggleStructure(establishment.id)}
                              disabled={isPending}
                            />
                            <span aria-hidden="true">{checked ? "✓" : "+"}</span>
                            {establishment.name}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {error && (
                  <p role="alert" className="font-bold text-rouge-imp">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  {editing && !(props.mode === "edit" && props.isSelf) && (
                    <ConfirmActionButton
                      label="Retirer l'accès"
                      icon={UserMinus}
                      question={`Retirer l'accès de ${editing.name} ? Son compte est désactivé, rien n'est supprimé : le journal garde son historique.`}
                      confirmLabel="Retirer l'accès"
                      onConfirm={async () => {
                        const result = await removeCabinetMemberAccess(editing.id);
                        if (!result) {
                          close();
                          router.refresh();
                        }
                        return result;
                      }}
                    />
                  )}
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {editing ? "Enregistrer" : "Envoyer l’invitation"}
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
