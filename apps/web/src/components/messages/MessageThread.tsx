"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { MessageAuthorSide } from "@eoda/database";
import type { MessageResult, ThreadMessage } from "@/lib/actions/message";
import {
  displayAuthor,
  groupMessagesByDay,
  MAX_MESSAGE_LENGTH,
  startsNewBlock,
} from "@/lib/services/message-thread-service";
import { formatDateTime, formatTime } from "@/lib/services/date-format-service";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2, MessagesSquare, Send } from "lucide-react";

type Props = {
  messages: ThreadMessage[];
  // Côté de CELUI QUI REGARDE : ses propres messages sont alignés à droite, comme
  // dans n'importe quelle conversation.
  viewerSide: MessageAuthorSide;
  canPost: boolean;
  // Action de publication, liée par la page appelante : le cabinet et le client
  // n'appellent pas la même (deux gardes distinctes, cf. lib/actions/message.ts).
  action: (state: MessageResult | null, formData: FormData) => Promise<MessageResult>;
  readOnlyNotice?: string;
};

// Le compteur n'apparaît qu'en approche de la limite. Affiché en permanence, il
// transforme une zone de texte en exercice de rédaction contrainte ; absent, on se
// fait couper sans savoir pourquoi.
const COUNTER_FROM = MAX_MESSAGE_LENGTH - 400;

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
  const [length, setLength] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const sent = state !== null && !("error" in state);

  // Après un envoi réussi : vider le champ et y remettre le focus. Sans ça, le
  // message reste affiché sous le fil où il vient d'apparaître — on croit qu'il n'est
  // pas parti, et on le renvoie.
  useEffect(() => {
    if (!sent || isPending) return;
    formRef.current?.reset();
    setLength(0);
    fieldRef.current?.focus();
  }, [sent, isPending]);

  // `now` figé au rendu et passé aux règles pures : « Aujourd'hui » se calcule à
  // partir d'une valeur, jamais d'une horloge lue au fond d'un composant.
  const groups = groupMessagesByDay(messages, new Date());

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gris-light bg-white px-6 py-10 text-center">
          <MessagesSquare className="h-6 w-6 text-terre/60" aria-hidden="true" />
          <p className="text-sm font-medium text-brun-ancre">La conversation est vide.</p>
          <p className="max-w-sm text-sm text-gris-mid">
            Ce fil sert aux questions courtes et au suivi. Les documents, eux, se déposent
            dans l&apos;espace documentaire.
          </p>
        </div>
      ) : (
        // `aria-live` : un message qui apparaît après un envoi doit être annoncé.
        // `polite` et non `assertive` — on n'interrompt pas quelqu'un en train de lire.
        <div className="space-y-5" aria-live="polite">
          {groups.map((group) => (
            <section key={group.key} className="space-y-2">
              {/* Séparateur de journée : la date quitte chaque bulle pour remonter
                  ici. Répétée vingt fois, elle noyait la seule information qu'on
                  cherche dans un fil — l'heure, et qui parle. */}
              <div className="flex items-center gap-3" role="separator" aria-label={group.heading}>
                <span className="h-px flex-1 bg-gris-light" />
                <span className="text-xs font-medium uppercase tracking-wide text-gris-mid">
                  {group.heading}
                </span>
                <span className="h-px flex-1 bg-gris-light" />
              </div>

              <ul className="space-y-1">
                {group.messages.map((message, index) => {
                  const mine = message.authorSide === viewerSide;
                  const newBlock = startsNewBlock(message, group.messages[index - 1]);

                  return (
                    <li
                      key={message.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"} ${
                        newBlock && index > 0 ? "pt-2" : ""
                      }`}
                    >
                      <div className={`max-w-[85%] sm:max-w-[75%] ${mine ? "text-right" : "text-left"}`}>
                        {/* L'auteur n'est réécrit qu'à un vrai changement de prise de
                            parole. Il n'est jamais SUPPRIMÉ pour autant : le nom reste
                            dans l'infobulle et dans le nom accessible de la bulle —
                            l'alignement seul ne dit rien à un lecteur d'écran, et rien
                            du tout une fois la page imprimée (`color-not-only`). */}
                        {newBlock && (
                          <p className="mb-1 px-1 text-xs font-medium text-brun-ancre">
                            {displayAuthor(message)}
                          </p>
                        )}
                        <div
                          className={`inline-block rounded-2xl border px-4 py-2.5 text-left ${
                            mine
                              ? "rounded-tr-sm border-terre/25 bg-terre/[0.07]"
                              : "rounded-tl-sm border-gris-light bg-white"
                          }`}
                        >
                          {/* `whitespace-pre-line` : les retours à la ligne de l'auteur
                              sont conservés. Sans ça, une liste de trois questions
                              devient un paragraphe illisible. */}
                          <p className="whitespace-pre-line text-sm leading-relaxed text-brun-ancre">
                            {message.body}
                          </p>
                          <p className="mt-1 text-[11px] tabular-nums text-gris-mid">
                            <span className="sr-only">{displayAuthor(message)}, </span>
                            <time
                              dateTime={message.createdAt.toISOString()}
                              title={formatDateTime(message.createdAt)}
                            >
                              {formatTime(message.createdAt)}
                            </time>
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canPost ? (
        <form ref={formRef} action={formAction} className="space-y-2">
          <Label htmlFor="message-body">Écrire un message</Label>
          <Textarea
            ref={fieldRef}
            id="message-body"
            name="body"
            rows={3}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isPending}
            placeholder="Une question, un point de suivi…"
            onChange={(event) => setLength(event.target.value.length)}
            // Raccourci attendu partout où l'on écrit un message. Entrée seule reste
            // un retour à la ligne : un fil sert aussi à poser trois questions à la
            // suite, et envoyer à la première serait une perte.
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />

          {state && "error" in state && (
            <p role="alert" className="flex items-center gap-2 text-sm text-rouge-imp">
              <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {state.error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-gris-mid">
              {length >= COUNTER_FROM ? (
                <span className="tabular-nums">
                  {length} / {MAX_MESSAGE_LENGTH} caractères
                </span>
              ) : sent && !isPending ? (
                // Confirmation explicite : le message apparaît bien dans le fil, mais
                // rien ne distingue « envoyé » de « la page n'a pas bougé ».
                <span className="flex items-center gap-1.5 text-vert-ok">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Message envoyé.
                </span>
              ) : (
                <>
                  Un message envoyé ne peut être ni modifié ni supprimé.
                  <span className="ml-1 hidden sm:inline">⌘/Ctrl + Entrée pour envoyer.</span>
                </>
              )}
            </div>
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
        readOnlyNotice && (
          <p className="rounded-lg border border-gris-light bg-ivoire px-4 py-3 text-sm text-gris-mid">
            {readOnlyNotice}
          </p>
        )
      )}
    </div>
  );
}
