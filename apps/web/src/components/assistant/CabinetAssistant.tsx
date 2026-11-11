"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  FileSearch,
  History,
  Library,
  MailQuestion,
  Palette,
  Search,
  ShieldCheck,
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
import { describeAssistantReading, firstName, groupConversationsByDate } from "@/lib/services/assistant-ui-service";
import { isCreditLow } from "@/lib/services/assistant-service";
import { useAssistantModel } from "./use-assistant-model";
import { cn } from "@/lib/utils";
import { ChatComposer } from "./ChatComposer";
import { ModelPicker } from "./ModelPicker";
import {
  AssistantMark,
  AssistantMessage,
  AssistantText,
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
//
// Maquettes du 11/11/2026 (canevas « Assistant EODA — refonte ») : en-tête de la
// colonne (marque + « Cabinet EODA »), « Nouvelle conversation » en aplat, recherche
// dans l'historique, crédits du jour en barre en bas de la colonne ; à vide, les
// tâches en cartes (icône, intitulé, une ligne) ; en conversation, le titre en tête et,
// sous chaque réponse, ce que l'assistant a LU et ce qu'elle a coûté
// (describeAssistantReading). Le menu du cabinet reste à gauche : on revient par lui.
// ─────────────────────────────────────────────────────────────────────────────

const COPY: Record<CabinetProposalKind, { title: string; confirm: string; tone: ProposalTone }> = {
  COMMENT: { title: "Consigne à retenir pour l'IA", confirm: "Ajouter aux commentaires", tone: "comment" },
  INFORMATION_REQUEST: { title: "Demande à la structure", confirm: "Envoyer la demande", tone: "request" },
  DESIGN_NOTES: { title: "Mise en page de la structure", confirm: "Enregistrer pour la structure", tone: "design" },
};
const TASK_ICONS: readonly LucideIcon[] = [ClipboardList, Eye, FileSearch, MailQuestion, Palette, Library];

function CreditCard({ used, limit }: { used: number; limit: number }) {
  const remaining = Math.max(0, limit - used);
  const low = isCreditLow(remaining);
  const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
  return (
    <div className="space-y-2 rounded-xl bg-soft p-3.5">
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-ink">Crédits du jour</span>
        <span className={cn("tabular-nums", low ? "font-bold text-danger-text" : "text-ink2")}>
          {remaining} sur {limit}
        </span>
      </p>
      <div role="img" aria-label={`${remaining} crédits restants sur ${limit}`} className="h-2 overflow-hidden rounded-full bg-line">
        <div className={cn("h-2 rounded-full", low ? "bg-danger-fill" : "bg-accent-fill")} style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-ink2">Remis à zéro à minuit.</p>
    </div>
  );
}

export function CabinetAssistant({ initial, userName }: { initial: CabinetAssistantState; userName: string | null }) {
  const [state, setState] = useState(initial);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");
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
    />
  );

  // La recherche porte sur les titres déjà chargés (les 30 dernières conversations).
  const needle = search.trim().toLocaleLowerCase("fr");
  const visible = needle ? state.conversations.filter((c) => c.title.toLocaleLowerCase("fr").includes(needle)) : state.conversations;
  const groups = groupConversationsByDate(visible, new Date());
  const currentTitle = state.conversations.find((c) => c.id === state.conversationId)?.title ?? null;

  return (
    <div className="assistant-thread grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
      {/* Historique : colonne à gauche ; sur un écran étroit, derrière « Historique ». */}
      <aside
        aria-label="Conversations"
        className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:border-r lg:border-line lg:pr-4"
      >
        <div className="hidden items-center gap-2.5 px-1 lg:flex">
          <AssistantMark />
          <span className="flex flex-col leading-tight">
            <span className="font-bold text-ink">Assistant</span>
            <span className="text-sm text-ink2">Cabinet EODA</span>
          </span>
        </div>
        <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
          <button
            type="button"
            onClick={() => open(null)}
            disabled={isPending}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent-fill px-3 font-bold text-on-accent transition-opacity hover:bg-accent-fill/90 disabled:opacity-50 lg:flex-none"
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
        <div className={cn("flex-col gap-4 lg:flex lg:min-h-0 lg:flex-1", historyOpen ? "flex" : "hidden")}>
        {state.conversations.length > 0 && (
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-ink2 focus-within:border-accent-text">
            <Search className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="sr-only">Rechercher une conversation</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink2"
            />
          </label>
        )}
        <nav aria-label="Historique des conversations" className="assistant-scroll space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          {state.conversations.length === 0 && <p className="px-3 text-sm text-ink2">Vos conversations s&apos;afficheront ici.</p>}
          {state.conversations.length > 0 && groups.length === 0 && (
            <p className="px-3 text-sm text-ink2">Aucune conversation ne correspond.</p>
          )}
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
        <CreditCard used={state.credits.used} limit={state.credits.limit} />
        </div>
      </aside>

      <section aria-label="Conversation avec l'assistant" className="min-w-0">
        {empty ? (
          <div className="mx-auto flex min-h-[62dvh] max-w-3xl flex-col justify-center gap-8 py-6">
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
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-ink2">Pour commencer</h3>
              <ul aria-label="Pour commencer" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PREDEFINED_TASKS.map((task, index) => {
                  const Icon = TASK_ICONS[index] ?? ClipboardList;
                  return (
                    <li key={task.label} className="flex">
                      <button
                        type="button"
                        disabled={!canAsk}
                        onClick={() => setQuestion(task.prompt)}
                        className="flex min-h-28 flex-1 flex-col items-start gap-2 rounded-xl border border-line bg-card p-4 text-left text-ink transition-colors hover:border-accent-text/40 hover:bg-soft disabled:opacity-50"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-highlight text-amber-text" aria-hidden="true">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-bold">{task.label}</span>
                        <span className="text-sm leading-snug text-ink2">{task.hint}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="flex items-center justify-center gap-2 text-center text-sm text-ink2">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              Des propositions à vérifier : l&apos;assistant ne valide rien et ne voit que vos structures.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            {currentTitle && (
              <h2 className="truncate border-b border-line pb-3 text-lg font-bold text-ink">{currentTitle}</h2>
            )}
            <ol aria-label="Échanges" className="space-y-8 pb-6 pt-4">
              {state.messages.map((message) =>
                message.role === "USER" ? (
                  <li key={message.id}>
                    <UserMessage>{message.content}</UserMessage>
                  </li>
                ) : (
                  <li key={message.id}>
                    <AssistantMessage>
                      <ReadingNote toolsUsed={message.toolsUsed} credits={message.credits} />
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

// Sous la marque, avant le texte : ce que l'assistant a lu pour répondre, et le coût.
function ReadingNote({ toolsUsed, credits }: { toolsUsed: readonly string[]; credits: number }) {
  const note = describeAssistantReading(toolsUsed, credits);
  if (!note) return null;
  return (
    <p className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-1.5 text-sm text-ink2">
      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-ok-text" aria-hidden="true" />
      {note}
    </p>
  );
}
