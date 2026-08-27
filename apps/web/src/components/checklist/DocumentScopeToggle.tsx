"use client";

import { useState, useTransition } from "react";
import { setDocumentTypeRequested } from "@/lib/actions/document";
import { AlertCircle, Loader2, Inbox, PenLine } from "lucide-react";

type Props = {
  documentTypeId: string;
  requestedFromClient: boolean;
  // Réservé à CABINET_ADMIN : la liste vaut pour tous les clients.
  canEdit: boolean;
};

// « Réclamé au client » ou « produit par EODA ». Rendu comme un état lisible avant
// d'être un bouton : c'est d'abord une information — qui doit fournir ce document —
// et accessoirement une bascule.
//
// Sandrine consulte ses experts sur la liste exacte des documents réclamés avant la
// visite ; elle doit pouvoir la corriger elle-même, sans qu'on touche à la base.
export function DocumentScopeToggle({ documentTypeId, requestedFromClient, canEdit }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const Icon = requestedFromClient ? Inbox : PenLine;
  const label = requestedFromClient ? "Réclamé au client" : "Produit par EODA";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setDocumentTypeRequested(documentTypeId, !requestedFromClient);
      if (result && "error" in result) setError(result.error);
    });
  }

  const content = (
    <>
      {isPending ? (
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="w-3 h-3" aria-hidden="true" />
      )}
      {label}
    </>
  );

  if (!canEdit) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gris-mid">{content}</span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        title={
          requestedFromClient
            ? "Basculer : ce document sera produit par EODA et cessera d'être réclamé au client"
            : "Basculer : ce document sera réclamé au client"
        }
        className="inline-flex items-center gap-1 rounded-full border border-gris-light px-2 py-0.5 text-xs text-gris-mid transition-colors hover:border-terre/40 hover:text-brun-ancre cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {content}
      </button>
      {error && (
        <span role="alert" className="inline-flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </span>
      )}
    </span>
  );
}
