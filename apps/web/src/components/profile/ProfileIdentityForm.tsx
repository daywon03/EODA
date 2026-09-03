"use client";

import { useActionState } from "react";
import { updateOwnProfile } from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type Props = { name: string; email: string };

// Le nom, et rien d'autre. L'e-mail est affiché parce qu'on vient souvent vérifier
// « sur quel compte suis-je connecté ? », mais il n'est pas modifiable ici : c'est
// l'identifiant de connexion, et le changer soi-même déplacerait le point d'entrée du
// compte sans qu'aucune vérification ne l'accompagne (règle S2). Le dire à l'écran
// vaut mieux qu'un champ grisé sans explication.
export function ProfileIdentityForm({ name, email }: Props) {
  const [state, formAction, isPending] = useActionState(updateOwnProfile, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="profile-name">Nom affiché</Label>
        <Input
          id="profile-name"
          name="name"
          defaultValue={name}
          maxLength={200}
          required
          disabled={isPending}
          autoComplete="name"
        />
        <p className="text-xs text-gris-mid">
          C&apos;est ce nom qui signe vos messages et vos dépôts de documents.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-email">Adresse e-mail</Label>
        <Input id="profile-email" value={email} readOnly disabled className="bg-ivoire" />
        <p className="text-xs text-gris-mid">
          C&apos;est votre identifiant de connexion. Pour le changer, écrivez à votre
          consultante EODA — elle seule peut le faire.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Enregistrer
        </Button>
        {state && "ok" in state && !isPending && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-vert-ok">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Profil enregistré.
          </p>
        )}
      </div>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-rouge-imp">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
