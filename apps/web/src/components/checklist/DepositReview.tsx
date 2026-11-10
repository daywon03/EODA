"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertCircle, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CANCEL_PENDING_NOTICE, formatFileSize } from "@/lib/services/document-deposit-service";
import type { AnalysisRunPhase } from "@/lib/services/analysis-progress-service";
import { AnalysisRunStatus } from "./AnalysisRunStatus";

// ─────────────────────────────────────────────────────────────────────────────
// Récapitulatif d'un dépôt AVANT l'envoi, puis suivi de l'envoi et son annulation
// (use-document-deposit). Un seul composant pour le cabinet et la structure : la
// densité change (DESIGN.md §3 — 44 px / 48 px, 16 px / 18 px), pas le contenu.
//
// Il dit ce qui va arriver — le fichier, la LIGNE où il va (l'intitulé du document),
// et ses effets réels (validation, e-mail) — avant le moindre octet envoyé. Pendant
// l'envoi, « Annuler le dépôt » ne prétend pas arrêter le serveur : il le dit.
// ─────────────────────────────────────────────────────────────────────────────

export function DepositReview({
  file,
  documentLabel,
  effects,
  density,
  sending,
  cancelRequested,
  phase,
  elapsedMs,
  error,
  onConfirm,
  onDiscard,
  onRequestCancel,
  children,
}: {
  file: File;
  documentLabel: string;
  effects: readonly string[];
  density: "cabinet" | "client";
  // L'action serveur tourne (dépôt puis analyse).
  sending: boolean;
  cancelRequested: boolean;
  phase: AnalysisRunPhase;
  elapsedMs: number;
  error: string | null;
  onConfirm: () => void;
  onDiscard: () => void;
  onRequestCancel: () => void;
  // Réglages propres au côté (cabinet : « Version finale d'EODA », modèle ; structure :
  // l'avertissement nominatif) — rendus entre les effets et les boutons.
  children?: ReactNode;
}) {
  const headingId = useId();
  const effectsId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const client = density === "client";

  // Le récapitulatif remplace le bouton qui vient d'ouvrir le sélecteur : sans ce
  // déplacement, le focus clavier retomberait sur le corps de la page.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "w-full min-w-0 space-y-3 rounded-xl border border-line bg-card text-left text-ink",
        client ? "p-4 text-lg" : "max-w-[420px] p-3 text-sm"
      )}
    >
      <h3 ref={heading} id={headingId} tabIndex={-1} className={cn("font-bold", client ? "text-xl" : "text-base")}>
        {sending ? "Dépôt en cours" : "Vérifiez avant de déposer"}
      </h3>

      <div className="flex items-center gap-3 rounded-lg bg-paper p-3">
        <FileText className={cn("flex-shrink-0 text-ink", client ? "h-9 w-9" : "h-6 w-6")} aria-hidden="true" />
        <div className="min-w-0">
          <p className="break-words font-bold">{file.name}</p>
          <p className={cn("text-ink2", client ? "text-base" : "text-sm")}>{formatFileSize(file.size)}</p>
        </div>
      </div>

      <p>
        <span className="text-ink2">Il ira dans : </span>
        <span className="font-bold">« {documentLabel} »</span>
      </p>

      <ul id={effectsId} className="space-y-1">
        {effects.map((effect) => (
          <li key={effect} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink2" />
            <span>{effect}</span>
          </li>
        ))}
      </ul>

      {children}

      {error && (
        <p role="alert" className="flex items-start gap-2 text-danger-text">
          <AlertCircle className={cn("mt-0.5 flex-shrink-0", client ? "h-5 w-5" : "h-4 w-4")} aria-hidden="true" />
          {error}
        </p>
      )}

      {sending ? (
        <div className="space-y-2">
          {cancelRequested ? (
            <p role="status" className="flex items-start gap-2 font-bold">
              <Loader2 className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin" aria-hidden="true" />
              {CANCEL_PENDING_NOTICE}
            </p>
          ) : (
            <>
              <AnalysisRunStatus
                phase={phase}
                elapsedMs={elapsedMs}
                subject="Analyse du document déposé"
                className="max-w-none"
              />
              <Button
                type="button"
                variant="outline"
                size={client ? "lg" : "default"}
                className={cn("w-full", client && "text-lg")}
                onClick={onRequestCancel}
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Annuler le dépôt
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size={client ? "lg" : "default"}
            className={cn("flex-1 font-bold", client && "text-lg")}
            onClick={onConfirm}
            aria-describedby={effectsId}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Déposer
          </Button>
          <Button
            type="button"
            variant="outline"
            size={client ? "lg" : "default"}
            className={cn(client && "text-lg")}
            onClick={onDiscard}
          >
            Annuler
          </Button>
        </div>
      )}
    </section>
  );
}
