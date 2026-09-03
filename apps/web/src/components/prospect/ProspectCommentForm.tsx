"use client";

import { useActionState, useEffect, useRef } from "react";
import { addProspectComment } from "@/lib/actions/prospect";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, MessageSquarePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export function ProspectCommentForm({ prospectId }: { prospectId: string }) {
  const [state, formAction, isPending] = useActionState(
    addProspectComment.bind(null, prospectId),
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Vidé après un enregistrement réussi. Sans ça, le texte reste sous les yeux
  // au-dessus de la ligne qu'il vient de créer, et on le saisit deux fois.
  useEffect(() => {
    if (!isPending && state === null) formRef.current?.reset();
  }, [isPending, state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <Label htmlFor="body">Consigner un échange</Label>
      <Textarea
        id="body"
        name="body"
        rows={3}
        required
        maxLength={2000}
        placeholder="Appel, e-mail reçu, question posée, objection, relance prévue..."
        disabled={isPending}
      />

      {state?.error && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-rouge-imp text-xs"
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Ajouter au dossier
        </Button>
        {/* Dit à l'avance ce que l'écran ne pourra pas défaire : une entrée
            d'historique ne se modifie ni ne se supprime. */}
        <span className="text-xs text-gris-mid">
          Une entrée ajoutée reste au dossier — elle ne peut plus être modifiée.
        </span>
      </div>
    </form>
  );
}
