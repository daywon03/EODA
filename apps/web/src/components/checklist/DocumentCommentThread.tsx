"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2, MessageSquarePlus } from "lucide-react";
import {
  addDocumentComment,
  listDocumentComments,
  setDocumentCommentAiUse,
  type DocumentCommentItem,
} from "@/lib/actions/document-comment";
import { MAX_DOCUMENT_COMMENT_LENGTH } from "@/lib/services/document-comment-thread-service";
import { formatDateTime } from "@/lib/services/date-format-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─────────────────────────────────────────────────────────────────────────────
// « Commentaires sur ce document » — un FIL (retour de Sandrine, 10/11/2026 : « J'ai
// cumulé les commentaires, car je ne vois pas l'historique »). On AJOUTE un
// commentaire, il s'empile daté avec son auteur ; rien ne s'écrase. Chaque commentaire
// a sa case « Pris en compte par l'IA » : l'analyse suivante relit tous ceux cochés.
// Cabinet seulement (lib/actions/document-comment.ts).
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentCommentThread({ establishmentId, documentTypeId }: { establishmentId: string; documentTypeId: string }) {
  const [comments, setComments] = useState<DocumentCommentItem[] | null>(null);
  const [text, setText] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();
  const listId = useId();

  useEffect(() => {
    let cancelled = false;
    void listDocumentComments(establishmentId, documentTypeId).then((result) => {
      if (!cancelled) setComments(result);
    });
    return () => {
      cancelled = true;
    };
  }, [establishmentId, documentTypeId]);

  function add() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await addDocumentComment(establishmentId, documentTypeId, text, aiEnabled);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setText("");
      setSaved(true);
      setComments(await listDocumentComments(establishmentId, documentTypeId));
    });
  }

  function toggleAi(commentId: string, enabled: boolean) {
    setError(null);
    setComments((list) => list?.map((c) => (c.id === commentId ? { ...c, aiEnabled: enabled } : c)) ?? null);
    startTransition(async () => {
      const result = await setDocumentCommentAiUse(establishmentId, commentId, enabled);
      if (result && "error" in result) setError(result.error);
      setComments(await listDocumentComments(establishmentId, documentTypeId));
    });
  }

  return (
    <section aria-labelledby={listId} className="space-y-3">
      <h3 id={listId} className="font-bold text-ink">
        Commentaires sur ce document{comments ? ` (${comments.length})` : ""}
      </h3>

      <div className="space-y-2">
        <label htmlFor={fieldId} className="block text-sm text-ink2">
          Nouveau commentaire — il s&apos;ajoute à l&apos;historique, rien n&apos;est remplacé.
        </label>
        <Textarea
          id={fieldId}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSaved(false);
          }}
          rows={2}
          maxLength={MAX_DOCUMENT_COMMENT_LENGTH}
          disabled={isPending}
          placeholder="Précision utile pour la relecture : version, périmètre, point de vigilance…"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button type="button" size="sm" onClick={add} disabled={isPending || text.trim().length === 0}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            )}
            Ajouter le commentaire
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={aiEnabled}
              disabled={isPending}
              onChange={(event) => setAiEnabled(event.target.checked)}
              className="h-4 w-4 accent-current"
            />
            Pris en compte par l&apos;IA
          </label>
        </div>
        {saved && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-ok-text">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Ajouté. S&apos;applique à la prochaine analyse (« Réanalyser »).
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-danger-text">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      {comments === null && (
        <p role="status" className="flex items-center gap-2 text-ink2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Chargement de l&apos;historique…
        </p>
      )}
      {comments?.length === 0 && <p className="text-ink2">Aucun commentaire pour l&apos;instant.</p>}
      {comments && comments.length > 0 && (
        <ol aria-label="Historique des commentaires" className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md border border-line bg-card px-3 py-2">
              <p className="text-sm text-ink2">
                {formatDateTime(comment.createdAt)}
                {comment.authorName ? ` · ${comment.authorName}` : " · avant l'historique"}
              </p>
              <p className={cn("mt-1 whitespace-pre-wrap break-words text-ink", !comment.aiEnabled && "text-ink2")}>
                {comment.text}
              </p>
              <label className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={comment.aiEnabled}
                  disabled={isPending}
                  onChange={(event) => toggleAi(comment.id, event.target.checked)}
                  className="h-4 w-4 accent-current"
                />
                Pris en compte par l&apos;IA
              </label>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
