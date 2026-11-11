"use client";

import { useId, useState, useTransition } from "react";
import { Loader2, MessageSquare, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import {
  askCabinetAssistant,
  deleteCabinetAssistantConversation,
  getCabinetAssistant,
  resolveCabinetAssistantProposal,
  type CabinetAssistantState,
} from "@/lib/actions/cabinet-assistant";
import { MAX_QUESTION_LENGTH } from "@/lib/services/assistant-service";
import { PREDEFINED_TASKS } from "@/lib/services/cabinet-assistant-tasks";
import type { CabinetProposalKind } from "@/lib/services/cabinet-assistant-agent";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CreditGauge, MessageBubble, ProposalCard, ThinkingIndicator } from "./assistant-parts";

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT DU MENU LATÉRAL (11/11/2026 — « comme MusicPlanner, mais pour EODA »).
// Fils de l'utilisatrice à gauche ; au centre, tâches prédéfinies, échanges et cartes
// (chaque carte nomme la structure et le document visés) ; crédits du jour en haut.
// ─────────────────────────────────────────────────────────────────────────────

const COPY: Record<CabinetProposalKind, { title: string; confirm: string }> = {
  COMMENT: { title: "Consigne à retenir pour l'IA", confirm: "Ajouter aux commentaires" },
  INFORMATION_REQUEST: { title: "Demande à la structure", confirm: "Envoyer la demande" },
  DESIGN_NOTES: { title: "Consignes de mise en page de la structure", confirm: "Enregistrer pour la structure" },
};

export function CabinetAssistant({ initial }: { initial: CabinetAssistantState }) {
  const [state, setState] = useState(initial);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();

  const outOfCredits = state.credits.used >= state.credits.limit;
  const canAsk = state.available && !outOfCredits && !thinking;

  async function refresh(conversationId: string | null) {
    setState(await getCabinetAssistant(conversationId));
  }

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !canAsk) return;
    setError(null);
    setThinking(true);
    startTransition(async () => {
      const result = await askCabinetAssistant(state.conversationId, trimmed);
      setThinking(false);
      if ("error" in result) {
        setError(result.error);
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
      const result = await resolveCabinetAssistantProposal(messageId, index, decision);
      if (result && "error" in result) setError(result.error);
      await refresh(state.conversationId);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCabinetAssistantConversation(id);
      await refresh(null);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Conversations avec l'assistant" className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start"
          disabled={isPending}
          onClick={() => setState((s) => ({ ...s, conversationId: null, messages: [] }))}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nouvelle conversation
        </Button>
        {state.conversations.length > 0 && (
          <ul className="space-y-1">
            {state.conversations.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startTransition(() => refresh(c.id))}
                  aria-current={c.id === state.conversationId ? "true" : undefined}
                  className={cn(
                    "flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-ink hover:bg-soft",
                    c.id === state.conversationId && "bg-soft font-bold"
                  )}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 text-ink2" aria-hidden="true" />
                  <span className="truncate">{c.title}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(c.id)}
                  disabled={isPending}
                  aria-label={`Supprimer la conversation « ${c.title} »`}
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <section aria-label="Échange avec l'assistant" className="min-w-0 space-y-4 rounded-xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-bold text-ink">
            <Sparkles className="h-4 w-4 text-accent-text" aria-hidden="true" />
            Il lit vos structures, leurs documents, analyses, images et mises en page, et le référentiel.
          </p>
          <CreditGauge used={state.credits.used} limit={state.credits.limit} />
        </div>
        <p className="text-sm text-ink2">
          Ses réponses sont des propositions à vérifier : il ne valide rien. Rien n&apos;est envoyé ni enregistré sans votre clic.
        </p>

        <div className="flex flex-wrap gap-2" aria-label="Tâches prédéfinies" role="group">
          {PREDEFINED_TASKS.map((task) => (
            <Button key={task.label} type="button" variant="outline" size="sm" disabled={!canAsk} onClick={() => setQuestion(task.prompt)}>
              {task.label}
            </Button>
          ))}
        </div>

        {state.messages.length > 0 && (
          <ol aria-label="Échanges" className="max-h-[60vh] space-y-3 overflow-y-auto">
            {state.messages.map((message) => (
              <li key={message.id} className="space-y-2">
                <MessageBubble role={message.role}>{message.content}</MessageBubble>
                {message.proposals.map((proposal, index) => (
                  <ProposalCard
                    key={index}
                    title={COPY[proposal.kind].title}
                    target={[proposal.establishmentName, proposal.documentLabel].filter(Boolean).join(" — ")}
                    text={proposal.text}
                    status={proposal.status}
                    confirmLabel={COPY[proposal.kind].confirm}
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

        {!state.available ? (
          <p className="text-ink2">L&apos;assistant n&apos;est pas configuré sur ce serveur.</p>
        ) : (
          <div className="space-y-2">
            <label htmlFor={fieldId} className="block text-sm text-ink2">
              {outOfCredits ? "Crédits du jour épuisés. Ils reviennent à minuit." : "Votre question (Ctrl + Entrée pour envoyer)"}
            </label>
            <Textarea
              id={fieldId}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ask(question);
              }}
              rows={3}
              maxLength={MAX_QUESTION_LENGTH}
              disabled={!canAsk}
              placeholder="ex : que manque-t-il au plan de crise de telle structure ? Retiens la mise en page de ses documents."
            />
            <Button type="button" onClick={() => ask(question)} disabled={!canAsk || question.trim().length === 0}>
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
    </div>
  );
}
