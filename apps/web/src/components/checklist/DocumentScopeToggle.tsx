"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const Icon = requestedFromClient ? Inbox : PenLine;
  const label = requestedFromClient ? "Réclamé au client" : "Produit par EODA";
  // « pour toutes les structures » : la bascule porte sur le TYPE de document, pas
  // sur la fiche où elle est affichée (test de bout en bout du 12/10/2026).
  const switchHint = requestedFromClient
    ? "Basculer pour toutes les structures : ce document sera produit par EODA et cessera d'être réclamé"
    : "Basculer pour toutes les structures : ce document sera réclamé à chaque structure";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setDocumentTypeRequested(documentTypeId, !requestedFromClient);
      if (result && "error" in result) setError(result.error);
      // L'action revalide les portails ; la page de cabinet « Documents réclamés »
      // se relit ici pour afficher le nouvel état sans rechargement.
      else router.refresh();
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
      <span className="inline-flex items-center gap-1 text-xs text-ink2">{content}</span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {/* La cible faisait 22 px de haut — la hauteur de son texte. Elle en fait 36,
          et son nom accessible dit l'état COURANT puis ce que le clic produira :
          « Basculer » seul ne dit ni d'où l'on part ni où l'on va. */}
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-label={`${label}. ${switchHint}`}
        title={switchHint}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gris-light px-3 py-2 text-xs text-ink2 transition-colors hover:border-terre/40 hover:text-brun-ancre cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
