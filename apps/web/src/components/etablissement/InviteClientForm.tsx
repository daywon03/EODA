"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteClientUser } from "@/lib/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Copy, Loader2, UserPlus } from "lucide-react";

// `defaultEmail` / `defaultName` : pré-remplissage depuis le contact du prospect à
// la fin du parcours de conversion. Ce sont des VALEURS PAR DÉFAUT — Sandrine les
// corrige si l'interlocuteur du portail n'est pas celui du démarchage.
type Props = {
  establishmentId: string;
  defaultEmail?: string | null;
  defaultName?: string | null;
};

type SuccessResult = { success: true; tempPassword: string; userName: string; userEmail: string };
type ErrorResult = { error: string };
type Result = SuccessResult | ErrorResult;

export function InviteClientForm({ establishmentId, defaultEmail, defaultName }: Props) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("establishmentId", establishmentId);
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

  function copyPassword(pwd: string) {
    void navigator.clipboard.writeText(pwd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (result && "success" in result) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-start gap-3 bg-vert-ok/10 border border-vert-ok/30 rounded-lg p-4">
          <CheckCircle2 className="w-5 h-5 text-vert-ok flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-brun-ancre">Compte créé pour {result.userName}</p>
            <p className="text-gris-mid">{result.userEmail}</p>
          </div>
        </div>
        <div className="bg-ivoire border border-gris-light rounded-lg p-4 space-y-2.5">
          <p className="text-xs text-gris-mid font-medium uppercase tracking-wide">
            Mot de passe temporaire — à communiquer à l&apos;interlocuteur
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-gris-light rounded px-3 py-2.5 text-sm font-mono text-brun-ancre tracking-wider tabular-nums">
              {result.tempPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copyPassword(result.tempPassword)}
              aria-label={copied ? "Mot de passe copié" : "Copier le mot de passe"}
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-vert-ok" aria-hidden="true" />
              ) : (
                <Copy className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-rouge-imp">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            Ce mot de passe ne sera plus affiché. Copiez-le avant de fermer.
          </p>
        </div>
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
