"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { MAX_QUESTION_LENGTH } from "@/lib/services/assistant-service";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// LE COMPOSEUR (refonte du 11/11/2026, façon ChatGPT / Claude). Un seul bloc arrondi :
// le champ qui grandit avec le texte (jusqu'à ~8 lignes), puis une barre avec le choix
// du modèle à gauche, l'état des crédits et l'envoi rond à droite. Entrée envoie,
// Maj + Entrée passe à la ligne. Partagé par l'assistant du menu et celui de la fiche.
// ─────────────────────────────────────────────────────────────────────────────

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  busy,
  placeholder,
  label,
  leading,
  trailing,
  autoFocus = false,
  size = "regular",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  // Nom accessible du champ (le texte d'aide visible ne suffit pas toujours).
  label: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  autoFocus?: boolean;
  size?: "regular" | "hero";
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const canSend = !disabled && !busy && value.trim().length > 0;

  // Le champ grandit avec son contenu, sans barre de défilement avant ~8 lignes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 224)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
      className={cn(
        "assistant-composer rounded-[1.75rem] border border-line bg-card shadow-eoda-md transition-shadow focus-within:shadow-eoda-lg",
        disabled && "opacity-80"
      )}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSend) onSubmit();
          }
        }}
        rows={1}
        maxLength={MAX_QUESTION_LENGTH}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "assistant-scroll block w-full resize-none bg-transparent px-5 text-ink placeholder:text-ink2 disabled:cursor-not-allowed",
          size === "hero" ? "min-h-[4.5rem] pt-5 text-lg leading-7" : "min-h-[3.25rem] pt-4 text-base leading-6"
        )}
      />
      <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-1">{leading}</div>
        {trailing}
        <button
          type="submit"
          disabled={!canSend}
          aria-label={busy ? "L'assistant répond" : "Envoyer la question"}
          className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent-fill text-on-accent shadow-eoda-sm transition-[transform,opacity] duration-150 hover:bg-accent-fill/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>
    </form>
  );
}
