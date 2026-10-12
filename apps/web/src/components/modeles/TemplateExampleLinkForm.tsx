"use client";

import { useId, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setTemplateDocumentType } from "@/lib/actions/template-example";
import { Button } from "@/components/ui/button";

// Rattacher un gabarit à un type de document (N8) : sa version FINALE devient un
// exemple validé pour la mise en conformité de ce type. Rappel affiché : un exemple
// est anonymisé AVANT dépôt et n'est jamais une pièce nominative (context/10 §9).
export function TemplateExampleLinkForm({
  templateId,
  documentTypeId,
  documentTypes,
}: {
  templateId: string;
  documentTypeId: string | null;
  documentTypes: { id: string; label: string }[];
}) {
  const selectId = useId();
  const [value, setValue] = useState(documentTypeId ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink2">
        La dernière version <strong>finale</strong> de ce gabarit sert d&apos;exemple à la mise en conformité de ce type
        de document, pour toutes les structures. Elle doit être anonymisée avant dépôt (nom, FINESS, SIRET, adresse,
        noms de personnes) et ne jamais être une pièce nominative (DIPC signé, projet personnalisé rempli).
      </p>
      <label htmlFor={selectId} className="block font-bold text-ink">
        Type de document illustré
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={selectId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 min-w-0 max-w-full rounded-md border border-line bg-card px-2 text-ink"
        >
          <option value="">Aucun (pas un exemple)</option>
          {documentTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={isPending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await setTemplateDocumentType(templateId, value || null);
              setMessage(result ? { tone: "error", text: result.error } : { tone: "ok", text: "Rattachement enregistré." });
            });
          }}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Enregistrer
        </Button>
      </div>
      {message && (
        <p role="alert" className={message.tone === "error" ? "font-bold text-danger-text" : "font-bold text-ok-text"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
