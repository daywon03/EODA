"use client";

import { useId, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { requestInformationFromStructure } from "@/lib/actions/information-request";
import { defaultInformationRequestTitle } from "@/lib/services/information-request-service";
import { MAX_ACTION_TITLE_LENGTH } from "@/lib/services/action-item-service";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// « Demander à la structure » depuis un élément manquant de l'analyse (09/11/2026).
// Le texte part prérempli (intitulé du document + élément attendu) ; la consultante
// le corrige, puis l'envoie : une tâche confiée à la structure, et un e-mail qui ne
// dit que l'intitulé du document. Côté cabinet seulement (garde DOCUMENTS_WRITE).
export function RequestFromStructure({
  establishmentId,
  documentTypeId,
  documentLabel,
  missingElement,
}: {
  establishmentId: string;
  documentTypeId: string;
  documentLabel: string;
  missingElement: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(() => defaultInformationRequestTitle(documentLabel, missingElement));
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();

  function send() {
    setFeedback(null);
    const data = new FormData();
    data.set("establishmentId", establishmentId);
    data.set("documentTypeId", documentTypeId);
    data.set("title", title);
    startTransition(async () => {
      const result = await requestInformationFromStructure(data);
      if ("error" in result) {
        setFeedback({ tone: "error", text: result.error });
        return;
      }
      setOpen(false);
      setFeedback({
        tone: "ok",
        text:
          result.notified > 0
            ? `Demande envoyée : tâche confiée à la structure, ${result.notified} personne${result.notified > 1 ? "s" : ""} prévenue${result.notified > 1 ? "s" : ""} par e-mail.`
            : "Tâche confiée à la structure. Aucun e-mail n'est parti (aucun compte joignable ou messagerie non configurée) : prévenez-la vous-même.",
      });
    });
  }

  if (feedback?.tone === "ok") {
    return (
      <p role="status" className="mt-1 flex items-start gap-1.5 text-sm text-ok-text">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {feedback.text}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${INLINE_ACTION_CLASS} font-bold`}>
        <Send className="h-4 w-4" aria-hidden="true" />
        Demander à la structure
      </button>
    );
  }

  return (
    <div className="mt-1 space-y-2 rounded-md border border-line bg-card p-3">
      <label htmlFor={fieldId} className="block text-sm font-bold text-ink">
        Demande envoyée à la structure (vous pouvez la modifier)
      </label>
      <Textarea
        id={fieldId}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={MAX_ACTION_TITLE_LENGTH}
        rows={3}
        disabled={isPending}
      />
      <p className="text-sm text-ink2">
        Elle devient une tâche de la structure. L&apos;e-mail ne dit que le nom du document et « une information est
        attendue ».
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={send} disabled={isPending || title.trim() === ""}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          Envoyer la demande
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
          Annuler
        </Button>
      </div>
      {feedback?.tone === "error" && (
        <p role="alert" className="text-sm text-danger-text">
          {feedback.text}
        </p>
      )}
    </div>
  );
}
