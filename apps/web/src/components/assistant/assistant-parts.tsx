"use client";

import type { ReactNode } from "react";
import { Check, CheckCircle2, FilePlus2, Palette, Send, Sparkles, StickyNote, X, type LucideIcon } from "lucide-react";
import { isCreditLow } from "@/lib/services/assistant-service";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Morceaux d'écran PARTAGÉS par l'assistant du menu et celui de la fiche document
// (refonte du 11/11/2026, façon ChatGPT / Claude) : une seule marque, une seule mise en
// texte, une seule carte d'action, un seul indicateur (D1).
// ─────────────────────────────────────────────────────────────────────────────

export function AssistantMark({ size = "regular" }: { size?: "regular" | "large" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex flex-shrink-0 items-center justify-center rounded-xl bg-accent-fill text-on-accent shadow-eoda-sm",
        size === "large" ? "h-12 w-12 rounded-2xl" : "h-8 w-8"
      )}
    >
      <Sparkles className={size === "large" ? "h-6 w-6" : "h-4 w-4"} />
    </span>
  );
}

export function CreditGauge({ used, limit }: { used: number; limit: number }) {
  const remaining = Math.max(0, limit - used);
  return (
    <span
      className={cn("whitespace-nowrap px-1 text-sm tabular-nums", isCreditLow(remaining) ? "font-bold text-danger-text" : "text-ink2")}
      title="Crédits restants aujourd'hui, remis à minuit"
    >
      {remaining}/{limit} crédits
    </span>
  );
}

// Texte brut de l'assistant → paragraphes et listes (les lignes « - » deviennent une
// vraie liste, lue comme telle par un lecteur d'écran).
export function AssistantText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="list-disc space-y-1 pl-5 marker:text-accent-text">
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(<p key={`p${blocks.length}`}>{paragraph.join(" ")}</p>);
      paragraph = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const item = /^[-•*]\s+(.*)$/.exec(line);
    if (item) {
      flushParagraph();
      list.push(item[1]!);
    } else if (line === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return <div className="space-y-3 break-words text-base leading-7 text-ink">{blocks}</div>;
}

export function UserMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-lg bg-soft px-5 py-3 text-base leading-7 text-ink">
        <span className="sr-only">Vous : </span>
        {children}
      </div>
    </div>
  );
}

export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <AssistantMark />
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        <span className="sr-only">Assistant : </span>
        {children}
      </div>
    </div>
  );
}

// Compat : l'ancienne bulle (utilisée par l'assistant de la fiche).
export function MessageBubble({ role, children }: { role: "USER" | "ASSISTANT"; children: ReactNode }) {
  return role === "USER" ? (
    <UserMessage>{children}</UserMessage>
  ) : (
    <AssistantMessage>{typeof children === "string" ? <AssistantText text={children} /> : children}</AssistantMessage>
  );
}

export function ThinkingIndicator({ label = "L'assistant consulte vos dossiers" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" role="status">
      <AssistantMark />
      <span className="flex items-center gap-2 text-ink2">
        {label}
        <span className="assistant-dots inline-flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
          <span className="h-1.5 w-1.5 rounded-full bg-accent-text" />
        </span>
      </span>
    </div>
  );
}

const STATUS_COPY = { APPLIED: "Fait", DISMISSED: "Écartée" } as const;
export type ProposalTone = "comment" | "request" | "design" | "addition";
const TONE_ICON: Record<ProposalTone, LucideIcon> = { comment: StickyNote, request: Send, design: Palette, addition: FilePlus2 };

// Une proposition à confirmer : rien ne s'écrit sans ce clic, et le serveur revérifie tout.
export function ProposalCard({
  title,
  target,
  text,
  status,
  confirmLabel,
  disabled,
  onConfirm,
  onDismiss,
  tone = "comment",
}: {
  title: string;
  target?: string | null;
  text: string;
  status: "PENDING" | "APPLIED" | "DISMISSED";
  confirmLabel: string;
  disabled: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
  tone?: ProposalTone;
}) {
  const Icon = TONE_ICON[tone];
  const done = status !== "PENDING";
  return (
    <section
      aria-label={title}
      className={cn("overflow-hidden rounded-2xl border bg-card shadow-eoda-sm", done ? "border-line" : "border-accent-text/30")}
    >
      <header className="flex items-start gap-3 px-4 pt-3.5">
        <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-soft text-accent-text" aria-hidden="true">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block font-bold text-ink">{title}</span>
          {target && <span className="block text-sm text-ink2">{target}</span>}
        </span>
      </header>
      <p className="whitespace-pre-wrap break-words px-4 pb-3 pl-[3.75rem] pt-2 text-ink">{text}</p>
      <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-soft/50 px-3 py-2">
        {done ? (
          <span className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-bold text-ink2">
            {status === "APPLIED" ? <CheckCircle2 className="h-4 w-4 text-ok-text" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
            {STATUS_COPY[status]}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-fill px-4 font-bold text-on-accent transition-opacity hover:bg-accent-fill/90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {confirmLabel}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={disabled}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 font-bold text-ink2 transition-colors hover:bg-card hover:text-ink disabled:opacity-50"
            >
              Écarter
            </button>
          </>
        )}
      </footer>
    </section>
  );
}
