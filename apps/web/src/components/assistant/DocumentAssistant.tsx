"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  askDocumentAssistant,
  deleteAssistantConversation,
  getDocumentAssistant,
  resolveAssistantProposal,
  type AssistantState,
} from "@/lib/actions/document-assistant";
import type { AssistantProposal } from "@/lib/services/assistant-service";
import { CreditGauge, MessageBubble, ProposalCard, ThinkingIndicator } from "./assistant-parts";
import { ChatComposer } from "./ChatComposer";
import { ModelPicker } from "./ModelPicker";
import { useAssistantModel } from "./use-assistant-model";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

// ─────────────────────────────────────────────────────────────────────────────
// L'ASSISTANT DE LA FICHE DOCUMENT (lot F, 11/11/2026 — « comme MusicPlanner »).
// Fil de questions / réponses sur CE document, jauge des crédits du jour, propositions
// en cartes (Confirmer / Écarter) : rien ne s'écrit sans clic, et le serveur revérifie
// tout. Pas de streaming : un indicateur dit que l'assistant réfléchit.
// ─────────────────────────────────────────────────────────────────────────────

const PROPOSAL_COPY: Record<AssistantProposal["kind"], { title: string; confirm: string }> = {
  COMMENT: { title: "Consigne à retenir pour l'IA", confirm: "Ajouter aux commentaires" },
  INFORMATION_REQUEST: { title: "Demande à la structure", confirm: "Envoyer la demande" },
  // Posé dans la mise en conformité, où il s'accepte ou se refuse : jamais écrit seul.
  ADDITION: { title: "Ajout au document", confirm: "Placer dans le document" },
};
const PROPOSAL_TONE = { COMMENT: "comment", INFORMATION_REQUEST: "request", ADDITION: "addition" } as const;

function proposalTarget(proposal: AssistantProposal): string | null {
  if (proposal.kind !== "ADDITION") return null;
  const where = proposal.anchor ? `Après « ${proposal.anchor} »` : "En fin de document";
  return proposal.criterionCode ? `${where} · critère ${proposal.criterionCode}` : where;
}

export function DocumentAssistant({ establishmentId, documentTypeId }: { establishmentId: string; documentTypeId: string }) {
  const [state, setState] = useState<AssistantState | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fieldId = useId();
  const pickerId = useId();
  const [model, setModel] = useAssistantModel();
  const router = useRouter();

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

  function ask() {
    const text = question.trim();
    if (!text || !state) return;
    setError(null);
    setThinking(true);
    startTransition(async () => {
      const result = await askDocumentAssistant(establishmentId, documentTypeId, state.conversationId, text, model);
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
      // Un ajout placé apparaît dans le document à côté : la page se redessine.
      if (!result && decision === "CONFIRM") router.refresh();
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
        <ol aria-label="Échanges avec l'assistant" className="assistant-scroll assistant-thread max-h-[32rem] space-y-6 overflow-y-auto pr-1">
          {state.messages.map((message) => (
            <li key={message.id} className="space-y-2">
              <MessageBubble role={message.role}>{message.content}</MessageBubble>
              {message.proposals.map((proposal, index) => (
                <ProposalCard
                  key={index}
                  tone={PROPOSAL_TONE[proposal.kind]}
                  title={PROPOSAL_COPY[proposal.kind].title}
                  target={proposalTarget(proposal)}
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
        <ChatComposer
          value={question}
          onChange={setQuestion}
          onSubmit={ask}
          disabled={outOfCredits}
          busy={thinking}
          label="Votre question sur ce document"
          placeholder={
            outOfCredits
              ? "Crédits du jour épuisés. Ils reviennent à minuit."
              : "Que veut dire « éléments attendus non retrouvés » ici ? Que faut-il ajouter ?"
          }
          leading={<ModelPicker value={model} onChange={setModel} disabled={thinking} />}
        />
      )}

      {error && (
        <p role="alert" className="text-danger-text">
          {error}
        </p>
      )}
    </section>
  );
}
