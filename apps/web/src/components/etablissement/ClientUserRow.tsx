"use client";

import { useState, useTransition } from "react";
import {
  removeClientUserFromEstablishment,
  resetClientUserPassword,
  setClientUserActive,
  updateClientUser,
} from "@/lib/actions/client-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Pencil,
  Power,
  UserMinus,
} from "lucide-react";

type Props = {
  establishmentId: string;
  user: { id: string; name: string; email: string; isActive: boolean };
  roleInEstablishment: string;
};

const ROLE_LABELS: Record<string, string> = {
  DIRECTEUR: "Directeur / Directrice",
  COORDINATEUR: "Coordinateur / Coordinatrice",
  ASSISTANT_QUALITE: "Assistant(e) qualité",
  AUTRE: "Autre",
};

// Ligne d'interlocuteur client — lecture ET révocation. Les trois opérations
// destructrices (retrait d'accès, désactivation, réinitialisation) posent une
// question en page avant l'appel serveur ; l'autorisation, elle, est refaite côté
// serveur dans tous les cas (une confirmation d'interface ne protège rien).
export function ClientUserRow({ establishmentId, user, roleInEstablishment }: Props) {
  const [isEditing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function baseFormData(): FormData {
    const data = new FormData();
    data.set("establishmentId", establishmentId);
    data.set("userId", user.id);
    return data;
  }

  function handleSubmitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("establishmentId", establishmentId);
    data.set("userId", user.id);
    setError(null);
    startTransition(async () => {
      const result = await updateClientUser(data);
      if ("error" in result) setError(result.error);
      else setEditing(false);
    });
  }

  // Réactiver ne se confirme pas : c'est le geste qui rend l'accès, pas celui qui
  // le retire. Seul le sens destructeur pose une question.
  function handleReactivate() {
    const data = baseFormData();
    data.set("isActive", "true");
    setError(null);
    startTransition(async () => {
      const result = await setClientUserActive(data);
      if ("error" in result) setError(result.error);
    });
  }

  async function deactivate() {
    const data = baseFormData();
    data.set("isActive", "false");
    const result = await setClientUserActive(data);
    return "error" in result ? result : null;
  }

  async function removeAccess() {
    const result = await removeClientUserFromEstablishment(baseFormData());
    return "error" in result ? result : null;
  }

  async function resetPassword() {
    const result = await resetClientUserPassword(baseFormData());
    if ("error" in result) return result;
    setTempPassword(result.tempPassword);
    return null;
  }

  function copyPassword(password: string) {
    void navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="py-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-brun-ancre">{user.name}</p>
          <p className="text-gris-mid text-xs">{user.email}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!user.isActive && <Badge variant="missing">Compte désactivé</Badge>}
          <Badge variant="outline">{ROLE_LABELS[roleInEstablishment] ?? roleInEstablishment}</Badge>
        </div>
      </div>

      {isEditing ? (
        <form onSubmit={handleSubmitEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-ivoire rounded-lg p-3">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${user.id}`}>Nom complet</Label>
            <Input id={`name-${user.id}`} name="name" defaultValue={user.name} required disabled={isPending} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`role-${user.id}`}>Fonction dans la structure</Label>
            <Select
              id={`role-${user.id}`}
              name="roleInEstablishment"
              defaultValue={roleInEstablishment}
              required
              disabled={isPending}
            >
              <option value="DIRECTEUR">Directeur / Directrice</option>
              <option value="COORDINATEUR">Coordinateur / Coordinatrice</option>
              <option value="ASSISTANT_QUALITE">Assistant(e) qualité</option>
              <option value="AUTRE">Autre</option>
            </Select>
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
              Enregistrer
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isPending}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)} disabled={isPending}>
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            Modifier
          </Button>
          <ConfirmActionButton
            tone="neutral"
            label="Réinitialiser le mot de passe"
            icon={KeyRound}
            question={`Réinitialiser le mot de passe de ${user.name} ? Son mot de passe actuel cessera immédiatement de fonctionner et ses sessions ouvertes seront fermées.`}
            confirmLabel="Réinitialiser"
            onConfirm={resetPassword}
            disabled={isPending}
          />
          {user.isActive ? (
            <ConfirmActionButton
              tone="neutral"
              label="Désactiver le compte"
              icon={Power}
              question={`Désactiver le compte de ${user.name} ? Il ne pourra plus se connecter, y compris depuis une session déjà ouverte. Réversible.`}
              confirmLabel="Désactiver"
              onConfirm={deactivate}
              disabled={isPending}
            />
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={handleReactivate} disabled={isPending}>
              <Power className="w-3.5 h-3.5" aria-hidden="true" />
              Réactiver le compte
            </Button>
          )}
          <ConfirmActionButton
            label="Retirer l'accès"
            icon={UserMinus}
            question={`Retirer l'accès de ${user.name} à cet établissement ? S'il ne lui reste aucun autre établissement, son compte sera désactivé. Cette action est irréversible.`}
            confirmLabel="Retirer l'accès"
            onConfirm={removeAccess}
            disabled={isPending}
          />
        </div>
      )}

      {tempPassword && (
        <div className="bg-ivoire border border-gris-light rounded-lg p-3 space-y-2">
          <p className="text-xs text-gris-mid font-medium uppercase tracking-wide">
            Nouveau mot de passe temporaire — à communiquer à l&apos;interlocuteur
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-gris-light rounded px-3 py-2 text-sm font-mono text-brun-ancre tracking-wider">
              {tempPassword}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copyPassword(tempPassword)}
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
            Ce mot de passe ne sera plus affiché. L&apos;interlocuteur devra en changer à sa
            prochaine connexion.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </li>
  );
}
