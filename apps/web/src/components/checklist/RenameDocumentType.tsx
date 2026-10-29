"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, PenLine } from "lucide-react";
import { renameDocumentType } from "@/lib/actions/document-type-creation";
import { DOCUMENT_TYPE_LABEL_MAX } from "@/lib/services/document-type-creation-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// « Renommer » une ligne de « Documents » — l'intitulé change pour TOUTES les
// structures à la fois (renameDocumentType, CABINET_ADMIN). Le bouton le dit : le
// geste ne touche pas que la fiche ouverte.
export function RenameDocumentType({ documentTypeId, label }: { documentTypeId: string; label: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await renameDocumentType(documentTypeId, value);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(label);
          setEditing(true);
        }}
        aria-label={`Renommer « ${label} » pour toutes les structures`}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-accent-text hover:underline"
      >
        <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
        Renommer
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label className="flex min-w-60 flex-1 flex-col gap-1">
        <span className="text-sm font-bold text-ink">Nouveau nom (pour toutes les structures)</span>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={DOCUMENT_TYPE_LABEL_MAX}
          disabled={isPending}
          required
          autoFocus
        />
      </label>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        Enregistrer
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isPending}>
        Annuler
      </Button>
      {error && (
        <p role="alert" className="flex w-full items-center gap-2 text-sm text-rouge-imp">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </form>
  );
}
