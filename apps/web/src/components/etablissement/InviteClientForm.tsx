"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteClientUser, linkExistingClientUser } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import type { InvitationDelivery } from "@/lib/services/email-delivery-service";
import { SetupLinkPanel } from "@/components/ui/temporary-password-panel";

// `defaultEmail` / `defaultName` : pré-remplissage depuis le contact du prospect à
// la fin du parcours de conversion. Ce sont des VALEURS PAR DÉFAUT — Sandrine les
// corrige si l'interlocuteur du portail n'est pas celui du démarchage.
type Props = {
  establishmentId: string;
  defaultEmail?: string | null;
  defaultName?: string | null;
};

type SuccessResult = {
  success: true;
  setupLink: string | null;
  userName: string;
  userEmail: string;
  invitationDelivery: InvitationDelivery;
};
type ErrorResult = { error: string; linkableEmail?: string };
type Result = SuccessResult | ErrorResult;

export function InviteClientForm({ establishmentId, defaultEmail, defaultName }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);

  // Fonction choisie au dernier envoi : reprise pour rattacher un compte existant.
  const [lastRole, setLastRole] = useState("");
  const [linked, setLinked] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("establishmentId", establishmentId);
    const role = formData.get("roleInEstablishment");
    setLastRole(typeof role === "string" ? role : "");
    setLinked(false);
    startTransition(async () => {
      const res = await inviteClientUser(formData);
      if (res && "success" in res && res.success === true) {
        setResult(res as SuccessResult);
        // La liste des interlocuteurs est rendue par le serveur : sans ce
        // rafraîchissement, le compte existe en base mais n'apparaît nulle part tant
        // que la page n'est pas rechargée à la main — c'est ce qui a été observé.
        //
        // `router.refresh()` re-rend l'arbre serveur en CONSERVANT l'état React des
        // composants client : le panneau du mot de passe temporaire, posé juste
        // au-dessus par setResult, reste affiché. C'est ce qui le distingue d'un
        // revalidatePath posé dans l'action serveur, qui avait effacé ce panneau —
        // et le mot de passe n'est affiché qu'une fois, il n'est stocké nulle part.
        router.refresh();
      } else if (res && "error" in res) {
        setResult(res as ErrorResult);
      }
    });
  }

  // Rattachement d'un compte existant du même cabinet : le serveur recalcule la
  // décision (existing-account-service), ce bouton ne fait que la proposer.
  function linkExisting(email: string) {
    const data = new FormData();
    data.set("establishmentId", establishmentId);
    data.set("email", email);
    data.set("roleInEstablishment", lastRole);
    startTransition(async () => {
      const res = await linkExistingClientUser(data);
      if ("error" in res) {
        setResult({ error: res.error });
        return;
      }
      setResult(null);
      setLinked(true);
      router.refresh();
    });
  }


  if (result && "success" in result) {
    return (
      <div className="space-y-4">
        <SetupLinkPanel
          userName={result.userName}
          userEmail={result.userEmail}
          setupLink={result.setupLink}
          invitationDelivery={result.invitationDelivery}
        />
        <Button
          variant="outline"
          // La liste est déjà à jour (rafraîchie à la création) : ce bouton ne fait
          // que rendre le formulaire vide.
          onClick={() => setResult(null)}
        >
          Inviter un autre interlocuteur
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nom complet</Label>
          <Input
            id="name"
            name="name"
            placeholder="Prénom Nom"
            defaultValue={defaultName ?? ""}
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="prenom.nom@structure.fr"
            defaultValue={defaultEmail ?? ""}
            required
            disabled={isPending}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="roleInEstablishment">Fonction dans la structure</Label>
        <Select id="roleInEstablishment" name="roleInEstablishment" required disabled={isPending}>
          <option value="">— Sélectionner —</option>
          <option value="DIRECTEUR">Directeur / Directrice</option>
          <option value="COORDINATEUR">Coordinateur / Coordinatrice</option>
          <option value="ASSISTANT_QUALITE">Assistant(e) qualité</option>
          <option value="RESPONSABLE_QUALITE">Responsable Qualité</option>
          <option value="AUTRE">Autre</option>
        </Select>
      </div>
      {result && "error" in result && (
        <div
          role="alert"
          className="flex items-center gap-2 text-rouge-imp text-sm bg-rouge-imp/10 border border-rouge-imp/20 rounded-md px-3 py-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{result.error}</span>
        </div>
      )}
      {result && "error" in result && result.linkableEmail && (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => linkExisting(result.linkableEmail ?? "")}
        >
          <UserPlus className="w-4 h-4" aria-hidden="true" />
          Rattacher ce compte à cette structure
        </Button>
      )}
      {linked && (
        <p role="status" className="flex items-center gap-2 text-sm text-ink">
          <CheckCircle2 className="w-4 h-4 text-ok-text" aria-hidden="true" />
          Compte rattaché : l&apos;interlocuteur se connecte avec son mot de passe habituel.
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <UserPlus className="w-4 h-4" aria-hidden="true" />
        )}
        Créer le compte
      </Button>
    </form>
  );
}
