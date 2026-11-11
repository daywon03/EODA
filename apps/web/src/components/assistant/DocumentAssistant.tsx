"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Loader2, MessageSquarePlus, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import {
  askDocumentAssistant,
  deleteAssistantConversation,
  getDocumentAssistant,
  resolveAssistantProposal,
  type AssistantState,
} from "@/lib/actions/document-assistant";
import { MAX_QUESTION_LENGTH, type AssistantProposal } from "@/lib/services/assistant-service";
import { CreditGauge, MessageBubble, ProposalCard, ThinkingIndicator } from "./assistant-parts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ─────────────────────────────────────────────────────────────────────────────
// L'ASSISTANT DE LA FICHE DOCUMENT (lot F, 11/11/2026 — « comme MusicPlanner »).
// Fil de questions / réponses sur CE document, jauge des crédits du jour, propositions
// en cartes (Confirmer / Écarter) : rien ne s'écrit sans clic, et le serveur revérifie
// tout. Pas de streaming : un indicateur dit que l'assistant réfléchit.
// ─────────────────────────────────────────────────────────────────────────────

const PROPOSAL_COPY: Record<AssistantProposal["kind"], { title: string; confirm: string }> = {
  COMMENT: { title: "Consigne à retenir pour l'IA", confirm: "Ajouter aux commentaires" },
  INFORMATION_REQUEST: { title: "Demande à la structure", confirm: "Envoyer la demande" },
};

export function DocumentAssistant({ establishmentId, documentTypeId }: { establishmentId: string; documentTypeId: string }) {
  const [state, setState] = useState<AssistantState | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();
  const pickerId = useId();

  async function refresh(conversationId: string | null) {
    setState(await getDocumentAssistant(establishmentId, documentTypeId, conversationId));
  }

  useEffect(() => {
    let cancelled = false;
    void getDocumentAssistant(establishmentId, documentTypeId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [establishmentId, documentTypeId]);

  if (!state) {
    return (
      <p role="status" className="flex items-center gap-2 text-ink2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Chargement de l&apos;assistant…
      </p>
    );
  }

  const remaining = Math.max(0, state.credits.limit - state.credits.used);
  const outOfCredits = remaining === 0;
  const canAsk = state.available && !outOfCredits && !thinking;

  function ask() {
    const text = question.trim();
    if (!text || !state) return;
    setError(null);
    setThinking(true);
    startTransition(async () => {
      const result = await askDocumentAssistant(establishmentId, documentTypeId, state.conversationId, text);
      setThinking(false);
      if ("error" in result) {
        setError(result.error);
        // Une erreur peut avoir créé la conversation et décompté des crédits.
        await refresh(state.conversationId);
        return;
      }
      setQuestion("");
      await refresh(result.conversationId);
    });
  }

  function decide(messageId: string, index: number, decision: "CONFIRM" | "DISMISS") {
    setError(null);
    startTransition(async () => {
      const result = await resolveAssistantProposal(establishmentId, messageId, index, decision);
      if (result && "error" in result) setError(result.error);
      await refresh(state?.conversationId ?? null);
    });
  }

  function remove() {
    if (!state?.conversationId) return;
    const id = state.conversationId;
    startTransition(async () => {
      await deleteAssistantConversation(establishmentId, id);
      await refresh(null);
    });
  }

  function startNew() {
    setError(null);
    setState((s) => (s ? { ...s, conversationId: null, messages: [] } : s));
  }

  return (
    <section aria-labelledby={`${fieldId}-title`} className="space-y-3 rounded-lg border border-line bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${fieldId}-title`} className="flex items-center gap-2 font-bold text-ink">
          <Sparkles className="h-4 w-4 text-accent-text" aria-hidden="true" />
          Assistant
        </h3>
        <CreditGauge used={state.credits.used} limit={state.credits.limit} />
      </div>
      <p className="text-sm text-ink2">
        Il lit ce document, son analyse, ses critères et vos commentaires. Ses réponses sont des propositions à vérifier :
        il ne valide rien.
      </p>

      {state.conversations.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label htmlFor={pickerId} className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm text-ink2">Conversation</span>
            <Select
              id={pickerId}
              value={state.conversationId ?? ""}
              onChange={(event) => {
                const id = event.target.value;
                if (id) startTransition(() => refresh(id));
                else startNew();
              }}
              disabled={isPending}
            >
              <option value="">Nouvelle conversation</option>
              {state.conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </label>
          <Button type="button" variant="outline" size="sm" onClick={startNew} disabled={isPending}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouvelle
          </Button>
          {state.conversationId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={isPending}
              aria-label="Supprimer cette conversation"
              title="Supprimer cette conversation"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      {state.messages.length > 0 && (
        <ol aria-label="Échanges avec l'assistant" className="max-h-[28rem] space-y-3 overflow-y-auto">
          {state.messages.map((message) => (
            <li key={message.id} className="space-y-2">
              <MessageBubble role={message.role}>{message.content}</MessageBubble>
              {message.proposals.map((proposal, index) => (
                <ProposalCard
                  key={index}
                  title={PROPOSAL_COPY[proposal.kind].title}
                  text={proposal.text}
                  status={proposal.status}
                  confirmLabel={PROPOSAL_COPY[proposal.kind].confirm}
                  disabled={isPending}
                  onConfirm={() => decide(message.id, index, "CONFIRM")}
                  onDismiss={() => decide(message.id, index, "DISMISS")}
                />
              ))}
            </li>
          ))}
        </ol>
      )}

      {thinking && <ThinkingIndicator />}

      {!state.available && state.unavailableReason && <p className="text-ink2">{state.unavailableReason}</p>}

      {state.available && (
        <div className="space-y-2">
          <label htmlFor={fieldId} className="block text-sm text-ink2">
            {outOfCredits ? "Crédits du jour épuisés. Ils reviennent à minuit." : "Votre question sur ce document"}
          </label>
          <Textarea
            id={fieldId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ask();
            }}
            rows={3}
            maxLength={MAX_QUESTION_LENGTH}
            disabled={!canAsk}
            placeholder="ex : que veut dire « éléments attendus non retrouvés » ici ? Que faut-il ajouter ?"
          />
          <Button type="button" onClick={ask} disabled={!canAsk || question.trim().length === 0}>
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Envoyer
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger-text">
          {error}
        </p>
      )}
    </section>
  );
}

// Le déclencheur : l'assistant (et ses lectures) ne se chargent qu'au clic.
export function DocumentAssistantLauncher({ establishmentId, documentTypeId }: { establishmentId: string; documentTypeId: string }) {
  const [open, setOpen] = useState(false);
  if (open) return <DocumentAssistant establishmentId={establishmentId} documentTypeId={documentTypeId} />;
  return (
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>
      <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
      Poser une question à l&apos;assistant
    </Button>
  );
}
