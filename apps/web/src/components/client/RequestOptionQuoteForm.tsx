"use client";

import { useState, useTransition } from "react";
import { requestOptionQuote } from "@/lib/actions/client-contract";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Check, Loader2, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  catalogueOptionId: string;
  optionLabel: string;
  alreadyRequested: boolean;
};

// Bouton « Demander un devis » — §12.3 : le client DEMANDE, Sandrine déclenche.
// Ce n'est volontairement PAS un achat : aucun paiement, aucun déblocage, aucune
// promesse de délai. Le seul effet visible pour le client est la bascule en
// « Demande transmise ».
export function RequestOptionQuoteForm({ catalogueOptionId, optionLabel, alreadyRequested }: Props) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  if (sent) {
    return (
      <Badge variant="incomplete" className="gap-1 whitespace-nowrap">
        <Check className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
        Demande transmise
      </Badge>
    );
  }

  function submit(formData: FormData): void {
    setError(null);
    startTransition(async () => {
      const result = await requestOptionQuote(formData);
      if (result.ok) {
        setSent(true);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Send className="w-3.5 h-3.5" aria-hidden="true" />
        Demander un devis
      </Button>
    );
  }

  return (
    <form action={submit} className="w-full sm:w-80 space-y-2">
      <input type="hidden" name="catalogueOptionId" value={catalogueOptionId} />
      <label htmlFor={`message-${catalogueOptionId}`} className="block text-xs text-gris-mid">
        Précisez votre besoin (facultatif) — {optionLabel}
      </label>
      <Textarea
        id={`message-${catalogueOptionId}`}
        name="message"
        rows={3}
        maxLength={1000}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Nombre de documents concernés, échéance souhaitée…"
      />
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-rouge-imp" role="alert">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          Envoyer la demande
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
