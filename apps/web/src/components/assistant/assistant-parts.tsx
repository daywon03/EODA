"use client";

import type { ReactNode } from "react";
import { Check, Loader2, X } from "lucide-react";
import { isCreditLow } from "@/lib/services/assistant-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Morceaux d'écran PARTAGÉS par l'assistant de la fiche document et celui du menu
// latéral (11/11/2026) : une seule jauge, une seule bulle, une seule carte (D1).

export function CreditGauge({ used, limit }: { used: number; limit: number }) {
  const remaining = Math.max(0, limit - used);
  return (
    <p className={cn("text-sm", isCreditLow(remaining) ? "font-bold text-danger-text" : "text-ink2")}>
      {remaining}/{limit} crédits aujourd&apos;hui
    </p>
  );
}

export function MessageBubble({ role, children }: { role: "USER" | "ASSISTANT"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-ink",
        role === "USER" ? "ml-8 bg-soft" : "border border-line bg-surface"
      )}
    >
      <span className="sr-only">{role === "USER" ? "Vous : " : "Assistant : "}</span>
      {children}
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <p role="status" className="flex items-center gap-2 text-ink2">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      L&apos;assistant réfléchit…
    </p>
  );
}

const STATUS_COPY = { PENDING: "", APPLIED: "Fait", DISMISSED: "Écartée" } as const;

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
}: {
  title: string;
  target?: string | null;
  text: string;
  status: "PENDING" | "APPLIED" | "DISMISSED";
  confirmLabel: string;
  disabled: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-accent-text/40 bg-card p-3">
      <p className="text-sm font-bold text-ink">{title}</p>
      {target && <p className="text-sm text-ink2">{target}</p>}
      <p className="whitespace-pre-wrap break-words text-ink">{text}</p>
      {status === "PENDING" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onConfirm} disabled={disabled}>
            <Check className="h-4 w-4" aria-hidden="true" />
            {confirmLabel}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss} disabled={disabled}>
            <X className="h-4 w-4" aria-hidden="true" />
            Écarter
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink2">{STATUS_COPY[status]}</p>
      )}
    </div>
  );
}
