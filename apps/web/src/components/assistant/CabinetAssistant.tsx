"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ClipboardList,
  FileSearch,
  History,
  Library,
  MailQuestion,
  Palette,
  SquarePen,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  askCabinetAssistant,
  deleteCabinetAssistantConversation,
  getCabinetAssistant,
  resolveCabinetAssistantProposal,
  type CabinetAssistantState,
} from "@/lib/actions/cabinet-assistant";
import { PREDEFINED_TASKS } from "@/lib/services/cabinet-assistant-tasks";
import type { CabinetProposalKind } from "@/lib/services/cabinet-assistant-agent";
import { firstName, groupConversationsByDate } from "@/lib/services/assistant-ui-service";
import { useAssistantModel } from "./use-assistant-model";
import { cn } from "@/lib/utils";
import { ChatComposer } from "./ChatComposer";
import { ModelPicker } from "./ModelPicker";
import {
  AssistantMark,
  AssistantMessage,
  AssistantText,
  CreditGauge,
  ProposalCard,
  ThinkingIndicator,
  UserMessage,
  type ProposalTone,
} from "./assistant-parts";

// ─────────────────────────────────────────────────────────────────────────────
// ASSISTANT DU MENU LATÉRAL — refonte du 11/11/2026 (« regarde ce que font ChatGPT,
// Claude… cela ne doit pas ressembler à ça »).
//   - à vide : salutation centrée, grand composeur au milieu, tâches prédéfinies ;
//   - en conversation : colonne de lecture centrée, questions à droite, réponses à
//     gauche sans bulle, cartes d'action dans le fil ; composeur flottant en bas ;
//   - historique groupé par date à gauche (repliable sur un écran étroit) ;
//   - choix du modèle dans le composeur, comme sur MusicPlanner.
// ─────────────────────────────────────────────────────────────────────────────

const COPY: Record<CabinetProposalKind, { title: string; confirm: string; tone: ProposalTone }> = {
  COMMENT: { title: "Consigne à retenir pour l'IA", confirm: "Ajouter aux commentaires", tone: "comment" },
  INFORMATION_REQUEST: { title: "Demande à la structure", confirm: "Envoyer la demande", tone: "request" },
  DESIGN_NOTES: { title: "Mise en page de la structure", confirm: "Enregistrer pour la structure", tone: "design" },
};
const TASK_ICONS: readonly LucideIcon[] = [ClipboardList, FileSearch, FileSearch, MailQuestion, Palette, Library];

export function CabinetAssistant({ initial, userName }: { initial: CabinetAssistantState; userName: string | null }) {
  const [state, setState] = useState(initial);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [model, setModel] = useAssistantModel();
  const endRef = useRef<HTMLDivElement>(null);

  const thinking = pending !== null;
  const outOfCredits = state.credits.used >= state.credits.limit;
  const canAsk = state.available && !outOfCredits && !thinking;
  const empty = state.messages.length === 0 && !thinking;
  const name = firstName(userName);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [state.messages.length, pending]);

  async function refresh(conversationId: string | null) {
    setState(await getCabinetAssistant(conversationId));
  }

  function ask(text = question) {
    const trimmed = text.trim();
    if (!trimmed || !canAsk) return;
    setError(null);
    setPending(trimmed);
    setQuestion("");
    startTransition(async () => {
      const result = await askCabinetAssistant(state.conversationId, trimmed, model);
      setPending(null);
      if ("error" in result) {
        setError(result.error);
        setQuestion(trimmed);
        await refresh(state.conversationId);
        return;
      }
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

  function open(id: string | null) {
    setError(null);
    setHistoryOpen(false);
    if (id === null) setState((s) => ({ ...s, conversationId: null, messages: [] }));
    else startTransition(() => refresh(id));
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCabinetAssistantConversation(id);
      await refresh(state.conversationId === id ? null : state.conversationId);
    });
  }

  const composer = (hero: boolean) => (
    <ChatComposer
      value={question}
      onChange={setQuestion}
      onSubmit={() => ask()}
      disabled={!state.available || outOfCredits}
      busy={thinking}
      size={hero ? "hero" : "regular"}
      autoFocus={hero}
      label="Votre question à l'assistant"
      placeholder={
        !state.available
          ? "L'assistant n'est pas configuré sur ce serveur."
          : outOfCredits
            ? "Crédits du jour épuisés. Ils reviennent à minuit."
            : hero
              ? "Demandez : où en sont mes structures, que manque-t-il au plan de crise…"
              : "Posez une autre question…"
      }
      leading={<ModelPicker value={model} onChange={setModel} disabled={thinking} />}
      trailing={<CreditGauge used={state.credits.used} limit={state.credits.limit} />}
    />
  );

  const groups = groupConversationsByDate(state.conversations, new Date());

  return (
    <div className="assistant-thread grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      {/* Historique : colonne à gauche ; sur un écran étroit, derrière « Historique ». */}
      <aside aria-label="Conversations" className="min-w-0 lg:sticky lg:top-4 lg:self-start lg:border-r lg:border-line lg:pr-4">
        <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
          <button
            type="button"
            onClick={() => open(null)}
            disabled={isPending}
            className="inline-flex min-h-11 flex-1 items-center gap-2 rounded-xl px-3 font-bold text-ink transition-colors hover:bg-soft lg:flex-none"
          >
            <SquarePen className="h-4 w-4" aria-hidden="true" />
            Nouvelle conversation
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-bold text-ink2 transition-colors hover:bg-soft lg:hidden"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Historique
          </button>
        </div>
        <nav aria-label="Historique des conversations" className={cn("mt-2 space-y-4", historyOpen ? "block" : "hidden lg:block")}>
          {groups.length === 0 && <p className="px-3 text-sm text-ink2">Vos conversations s&apos;afficheront ici.</p>}
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-sm font-bold text-ink2">{group.label}</p>
              <ul className="space-y-0.5">
                {group.items.map((c) => {
                  const current = c.id === state.conversationId;
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => open(c.id)}
                        aria-current={current ? "true" : undefined}
                        className={cn(
                          "flex min-h-11 w-full min-w-0 items-center rounded-xl px-3 pr-12 text-left transition-colors hover:bg-soft lg:pr-3 lg:group-focus-within:pr-12 lg:group-hover:pr-12",
                          current ? "bg-soft font-bold text-ink" : "text-ink"
                        )}
                      >
                        <span className="truncate">{c.title}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(c.id)}
                        disabled={isPending}
                        aria-label={`Supprimer la conversation « ${c.title} »`}
                        title="Supprimer"
                        className="absolute right-0 top-0 inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink2 transition-opacity hover:text-danger-text lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <section aria-label="Conversation avec l'assistant" className="min-w-0">
        {empty ? (
          <div className="mx-auto flex min-h-[62dvh] max-w-2xl flex-col justify-center gap-8 py-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <AssistantMark size="large" />
              <h2 className="text-balance text-3xl font-bold leading-tight text-ink">
                {name ? `Bonjour ${name}, que préparons-nous ?` : "Que préparons-nous ?"}
              </h2>
              <p className="max-w-lg text-pretty text-ink2">
                Je lis vos structures, leurs documents, leurs analyses et leur mise en page, et le référentiel HAS. Je propose ;
                vous décidez.
              </p>
            </div>
            {composer(true)}
            <ul aria-label="Pour commencer" className="flex flex-wrap justify-center gap-2">
              {PREDEFINED_TASKS.map((task, index) => {
                const Icon = TASK_ICONS[index] ?? ClipboardList;
                return (
                  <li key={task.label}>
                    <button
                      type="button"
                      disabled={!canAsk}
                      onClick={() => setQuestion(task.prompt)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-ink shadow-eoda-sm transition-colors hover:border-accent-text/40 hover:bg-soft disabled:opacity-50"
                    >
                      <Icon className="h-4 w-4 text-accent-text" aria-hidden="true" />
                      {task.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <ol aria-label="Échanges" className="space-y-8 pb-6 pt-2">
              {state.messages.map((message) =>
                message.role === "USER" ? (
                  <li key={message.id}>
                    <UserMessage>{message.content}</UserMessage>
                  </li>
                ) : (
                  <li key={message.id}>
                    <AssistantMessage>
                      <AssistantText text={message.content} />
                      {message.proposals.map((proposal, index) => (
                        <ProposalCard
                          key={index}
                          title={COPY[proposal.kind].title}
                          tone={COPY[proposal.kind].tone}
                          target={[proposal.establishmentName, proposal.documentLabel].filter(Boolean).join(" · ")}
                          text={proposal.text}
                          status={proposal.status}
                          confirmLabel={COPY[proposal.kind].confirm}
                          disabled={isPending}
                          onConfirm={() => decide(message.id, index, "CONFIRM")}
                          onDismiss={() => decide(message.id, index, "DISMISS")}
                        />
                      ))}
                    </AssistantMessage>
                  </li>
                )
              )}
              {pending && (
                <li>
                  <UserMessage>{pending}</UserMessage>
                </li>
              )}
              {pending && (
                <li>
                  <ThinkingIndicator />
                </li>
              )}
            </ol>
            <div ref={endRef} />
            <div className="sticky bottom-0 bg-gradient-to-t from-paper from-70% to-transparent pb-4 pt-6">
              {composer(false)}
              <p className="mt-2 text-center text-sm text-ink2">Des propositions à vérifier : l&apos;assistant ne valide rien.</p>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mx-auto mt-2 max-w-3xl rounded-xl bg-danger-fill/10 px-4 py-3 text-danger-text">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
