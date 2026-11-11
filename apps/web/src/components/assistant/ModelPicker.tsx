"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { ASSISTANT_MODELS, formatCostFactor, resolveAssistantModel } from "@/lib/llm/assistant-models";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// CHOIX DU MODÈLE (11/11/2026 — « comme sur MusicPlanner »). Menu qui s'ouvre VERS LE
// HAUT depuis le composeur : nom, fournisseur, ce qu'il fait bien, facteur de coût
// (indicatif : les crédits suivent le coût réel), coche. Clavier : flèches, Entrée,
// Échap ; clic à l'extérieur pour fermer. Le focus revient au bouton à la fermeture.
// ─────────────────────────────────────────────────────────────────────────────

export function ModelPicker({ value, disabled, onChange }: { value: string; disabled?: boolean; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = resolveAssistantModel(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    listRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function openMenu() {
    setActive(Math.max(0, ASSISTANT_MODELS.findIndex((m) => m.id === current.id)));
    setOpen(true);
  }
  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }
  function choose(id: string) {
    onChange(id);
    close();
  }
  function onKey(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(ASSISTANT_MODELS.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(ASSISTANT_MODELS.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const model = ASSISTANT_MODELS[active];
      if (model) choose(model.id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Modèle : ${current.label}. Changer de modèle`}
        onClick={() => (open ? close() : openMenu())}
        className={cn(
          "inline-flex min-h-11 min-w-0 max-w-[15rem] items-center gap-1.5 rounded-full px-3 text-sm font-bold text-ink2 transition-colors hover:bg-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
          open && "bg-soft text-ink"
        )}
      >
        <span className="truncate">{current.label}</span>
        <ChevronDown className={cn("h-4 w-4 flex-shrink-0 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="assistant-pop absolute bottom-full left-0 z-50 mb-2 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-eoda-lg">
          <p className="border-b border-line px-4 py-2.5 text-sm font-bold text-ink2">Modèle de l&apos;assistant</p>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Modèle de l'assistant"
            aria-activedescendant={`${listId}-${active}`}
            tabIndex={-1}
            onKeyDown={onKey}
            className="assistant-scroll max-h-[min(26rem,55dvh)] overflow-y-auto overscroll-contain p-1.5"
          >
            {ASSISTANT_MODELS.map((model, index) => {
              const selected = model.id === current.id;
              return (
                <li
                  key={model.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selected}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => choose(model.id)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2",
                    index === active ? "bg-soft" : "bg-transparent"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink">{model.label}</span>
                    <span className="block text-sm text-ink2">
                      {model.provider} · {model.description}
                    </span>
                  </span>
                  <span className="flex-shrink-0 rounded-full bg-soft px-2 text-sm font-bold tabular-nums text-ink2" title="Coût relatif d'une question">
                    {formatCostFactor(model.costFactor)}
                  </span>
                  <Check className={cn("h-4 w-4 flex-shrink-0 text-accent-text", selected ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line px-4 py-2 text-sm text-ink2">
            Le facteur compare le coût d&apos;une question ; les crédits suivent le coût réel.
          </p>
        </div>
      )}
    </div>
  );
}
