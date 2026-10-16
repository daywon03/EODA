"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { tabletSignIn } from "@/lib/actions/tablet";
import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import { PasswordInput } from "@/components/ui/password-input";
import { TABLET_CHOICE, TABLET_CHOICE_OFF, TABLET_CHOICE_ON, TABLET_INPUT, TABLET_PRIMARY } from "./tablet-ui";

// Connexion sur une tablette ENREGISTRÉE : « C'est moi » puis le code à 6 chiffres.
// Le code saisi est effacé après chaque essai (il ne reste jamais à l'écran) ; le
// reste du formulaire, lui, ne bouge pas.
type State = { error: string } | { ok: true } | null;

export function TabletSignIn({ staff }: { staff: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [state, formAction, isPending] = useActionState<State, FormData>(async (_previous, data) => {
    const result = await tabletSignIn(data);
    setPin("");
    if ("ok" in result) router.refresh();
    return result;
  }, null);

  if (staff.length === 0) {
    return (
      <div className="flex max-w-[760px] flex-col gap-3">
        <h1 className="text-[34px] font-bold">Personne ne peut encore se connecter</h1>
        <p>La direction donne à chaque intervenant un code personnel, depuis « Personnes accompagnées » dans le portail.</p>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submitWithoutReset(formAction)} className="mx-auto flex max-w-[760px] flex-col gap-6">
      <h1 className="text-[34px] font-bold">Qui utilise la tablette ?</h1>
      <input type="hidden" name="staffMemberId" value={staffId ?? ""} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {staff.map((member) => (
          <li key={member.id}>
            <button type="button" aria-pressed={staffId === member.id} onClick={() => setStaffId(member.id)} className={cn(TABLET_CHOICE, staffId === member.id ? TABLET_CHOICE_ON : TABLET_CHOICE_OFF)}>
              {member.displayName}
            </button>
          </li>
        ))}
      </ul>
      {staffId && (
        <label className="flex max-w-[360px] flex-col gap-2 text-[21px] font-bold">
          Votre code (6 chiffres)
          <PasswordInput
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{6}"
            maxLength={6}
            required
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className={cn(TABLET_INPUT, "h-[60px] tracking-[0.3em] tabular-nums")}
          />
        </label>
      )}
      {state && "error" in state && <p role="alert" className="text-[19px] font-bold text-danger-text">{state.error}</p>}
      <button type="submit" disabled={!staffId || pin.length !== 6 || isPending} className={TABLET_PRIMARY}>
        {isPending ? "Vérification…" : "Ouvrir la tablette"}
      </button>
    </form>
  );
}
