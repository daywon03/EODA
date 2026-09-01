"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { changeDevisStatus } from "@/lib/actions/devis";
import { DEVIS_ALLOWED_TRANSITIONS } from "@/lib/services/devis-transition-service";
import { isConversionTransition } from "@/lib/services/conversion-service";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { AlertCircle, Ban, Loader2, Send, CheckCircle2, XCircle } from "lucide-react";
import type { DevisStatus } from "@eoda/database";

// Libellés et icônes de chaque cible de transition. La liste des transitions
// AUTORISÉES, elle, n'est plus écrite ici : elle vient de
// `lib/services/devis-transition-service.ts`, que l'action serveur applique aussi.
// Une table de transitions qui ne vit que dans un composant client n'est pas un
// contrôle — c'est une suggestion (constat N4 de l'audit).
const TRANSITION_UI: Record<
  DevisStatus,
  { label: string; icon: typeof Send; variant: "outline" | "destructive"; confirm?: string }
> = {
  BROUILLON: { label: "Repasser en brouillon", icon: Send, variant: "outline" },
  ENVOYE: { label: "Marquer comme envoyé", icon: Send, variant: "outline" },
  SIGNE: { label: "Marquer comme signé", icon: CheckCircle2, variant: "outline" },
  REFUSE: { label: "Marquer comme refusé", icon: XCircle, variant: "outline" },
  ANNULE: {
    label: "Annuler le devis",
    icon: Ban,
    variant: "destructive",
    confirm:
      "Annuler ce devis ? Il conserve son numéro dans la série annuelle mais sort définitivement des indicateurs commerciaux. Cette opération est irréversible.",
  },
};

export function DevisStatusActions({ devisId, status }: { devisId: string; status: DevisStatus }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const allowed = DEVIS_ALLOWED_TRANSITIONS[status];

  // La signature n'est pas un simple changement de statut : elle crée la fiche
  // client, la mission et le périmètre ouvert au client (§12.4), et exige le type de
  // SAD que rien ne permet de deviner. Elle part donc vers son propre écran, et
  // `changeDevisStatus` la refuse côté serveur — l'UI n'étant jamais un contrôle.
  const canSign = allowed.some(isConversionTransition);
  const nextStatuses = allowed.filter((next) => !isConversionTransition(next));

  if (!canSign && nextStatuses.length === 0) return null;

  function handleClick(nextStatus: DevisStatus) {
    setError(null);
    startTransition(async () => {
      const result = await changeDevisStatus(devisId, nextStatus);
      if (result && "error" in result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canSign && (
          <Button size="sm" asChild>
            <Link href={`/dashboard/cabinet/commercial/devis/${devisId}/signature`}>
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Enregistrer la signature
            </Link>
          </Button>
        )}
        {nextStatuses.map((next) => {
          const { label, icon: Icon, variant, confirm } = TRANSITION_UI[next];
          // Une transition qui porte une question la pose en page ; les autres
          // partent directement. Même table, même libellé, même icône : la
          // confirmation est un attribut de la transition, pas un composant à part.
          if (confirm) {
            return (
              <ConfirmActionButton
                key={next}
                label={label}
                icon={Icon}
                question={confirm}
                confirmLabel={label}
                onConfirm={() => changeDevisStatus(devisId, next)}
                disabled={isPending}
              />
            );
          }
          return (
            <Button
              key={next}
              type="button"
              size="sm"
              variant={variant}
              disabled={isPending}
              onClick={() => handleClick(next)}
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {label}
            </Button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1 text-xs text-rouge-imp">
          <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
