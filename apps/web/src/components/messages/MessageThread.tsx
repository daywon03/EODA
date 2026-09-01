"use client";

import { useActionState } from "react";
import type { MessageAuthorSide } from "@eoda/database";
import type { MessageResult, ThreadMessage } from "@/lib/actions/message";
import {
  displayAuthor,
  MAX_MESSAGE_LENGTH,
} from "@/lib/services/message-thread-service";
import { formatDate } from "@/lib/services/date-format-service";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, Send } from "lucide-react";

type Props = {
  messages: ThreadMessage[];
  // Côté de CELUI QUI REGARDE : ses propres messages sont alignés à droite, comme
  // dans n'importe quelle conversation. Sans ça, un fil de dix messages devient un
  // mur de texte où l'on ne sait plus qui parle.
  viewerSide: MessageAuthorSide;
  canPost: boolean;
  // Action de publication, liée par la page appelante : le cabinet et le client
  // n'appellent pas la même (deux gardes distinctes, cf. lib/actions/message.ts).
  action: (state: MessageResult | null, formData: FormData) => Promise<MessageResult>;
  readOnlyNotice?: string;
};

const TEXTAREA_CLASS =
  "w-full rounded-md border border-gris-light bg-white px-3 py-2 text-sm text-brun-ancre placeholder:text-gris-mid focus:outline-none focus:ring-2 focus:ring-terre/40 focus:border-terre disabled:opacity-60";

// Fil d'échange, rendu à l'identique des deux côtés — un seul composant, parce que
// c'est une seule conversation (D1). Ce qui change d'un portail à l'autre est passé en
// props : le côté du lecteur, et l'action serveur qui publie.
export function MessageThread({
  messages,
  viewerSide,
  canPost,
  action,
  readOnlyNotice,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="rounded-lg border border-gris-light bg-white px-5 py-6 text-center text-sm text-gris-mid">
          Aucun message pour l&apos;instant. Ce fil sert aux questions courtes et au suivi —
          les documents, eux, se déposent dans l&apos;espace documentaire.
        </p>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => {
            const mine = message.authorSide === viewerSide;
            return (
              <li key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-xl border px-4 py-3 ${
                    mine
                      ? "border-terre/30 bg-terre/5"
                      : "border-gris-light bg-white"
                  }`}
                >
                  <p className="text-xs text-gris-mid">
                    {displayAuthor(message)} · {formatDate(message.createdAt)}
                  </p>
                  {/* `whitespace-pre-line` : les retours à la ligne de l'auteur sont
                      conservés. Sans ça, une liste de trois questions devient un
                      paragraphe illisible. */}
                  <p className="mt-1 whitespace-pre-line text-sm text-brun-ancre">
                    {message.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canPost ? (
        <form action={formAction} className="space-y-2">
          <textarea
            name="body"
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isPending}
            placeholder="Votre message…"
            className={TEXTAREA_CLASS}
          />

          {state && "error" in state && (
            <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {state.error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gris-mid">
              Un message envoyé ne peut pas être modifié ni supprimé.
            </p>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Envoyer
            </Button>
          </div>
        </form>
      ) : (
        readOnlyNotice && <p className="text-sm text-gris-mid">{readOnlyNotice}</p>
      )}
    </div>
  );
}
