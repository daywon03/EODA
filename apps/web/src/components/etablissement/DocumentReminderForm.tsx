"use client";

import { useActionState, useState } from "react";
import { sendDocumentReminder } from "@/lib/actions/reminder";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  establishmentId: string;
  // Nombre de pièces réclamées et manquantes, calculé côté serveur pour l'affichage.
  // L'action le recalcule de son côté : ce nombre informe, il n'autorise rien.
  missingCount: number;
};


// Relance des pièces manquantes. Un geste, pas un automate : la cadence des relances
// n'a jamais été spécifiée (§12.7), et un rythme inventé ici serait soit inutile,
// soit harcelant.
//
// Le mot d'accompagnement est FACULTATIF mais proposé : une relance qu'on ne peut pas
// nuancer (« comme convenu hier au téléphone… ») ne sera pas envoyée du tout.
export function DocumentReminderForm({ establishmentId, missingCount }: Props) {
  const [state, formAction, isPending] = useActionState(
    sendDocumentReminder.bind(null, establishmentId),
    null
  );
  const [open, setOpen] = useState(false);

  if (missingCount === 0) {
    return (
      <p className="text-sm text-gris-mid">
        Aucune pièce réclamée ne manque : il n&apos;y a rien à relancer.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gris-mid">
          {missingCount} pièce{missingCount > 1 ? "s" : ""} réclamée
          {missingCount > 1 ? "s" : ""} manque{missingCount > 1 ? "nt" : ""} encore.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          Préparer une relance
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-gris-mid">
        La liste des pièces manquantes est jointe automatiquement au message. Les pièces
        déjà justifiées par le client n&apos;y figurent pas.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="reminder-message">Mot d&apos;accompagnement (facultatif)</Label>
        <Textarea
          id="reminder-message"
          name="message"
          rows={3}
          maxLength={1000}
          disabled={isPending}
          placeholder="Par exemple : comme convenu lors de notre échange de mardi…"
        />
      </div>

      {state && "error" in state && (
        <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      {state && "ok" in state && (
        <p className="flex items-center gap-2 text-sm text-vert-ok">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Envoyer la relance
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
