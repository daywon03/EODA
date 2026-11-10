"use client";

import { useRef, useState } from "react";
import { cancelDocumentDeposit, uploadDocument } from "@/lib/actions/document";
import { prepareDocumentPages } from "@/lib/services/document-viewer-service";
import {
  CANCELLED_BEFORE_DEPOSIT,
  describeCancelledDeposit,
  type DepositSide,
} from "@/lib/services/document-deposit-service";
import { useAnalysisRun } from "./use-analysis-run";

// ─────────────────────────────────────────────────────────────────────────────
// Dépôt en deux temps, annulable — UNE logique pour le cabinet (DocumentUploadButton)
// et la structure (ClientUploadDialog). Retour de Sandrine du 09/11/2026 : « je me
// suis trompée et je n'ai pas pu empêcher l'action ».
//
//   choose(file)   → rien ne part : le fichier attend le récapitulatif (DepositReview) ;
//   discard()      → retour à l'état initial, fichier oublié ;
//   send(formData) → `uploadDocument` ; la progression est celle de use-analysis-run ;
//   requestCancel()→ une action serveur ne s'interrompt pas : l'annulation est NOTÉE,
//                    et dès que le serveur rend l'identifiant de la version,
//                    `cancelDocumentDeposit` la retire. Le message final dit ce qui a
//                    été défait, et ce qui était déjà parti (e-mail).
// ─────────────────────────────────────────────────────────────────────────────

const SEND_FAILED = "Le dépôt n'a pas abouti (connexion interrompue ?). Réessayez.";

type Attempt =
  | { kind: "deposited"; versionId: string }
  | { kind: "refused"; error: string }
  | { kind: "cancelled"; message: string }
  | { kind: "cancel-failed"; error: string };

export type DepositOutcome = { kind: "deposited"; versionId: string } | { kind: "cancelled"; message: string } | null;

export function useDocumentDeposit(side: DepositSide) {
  const { phase, elapsedMs, run, busy } = useAnalysisRun();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DepositOutcome>(null);
  const [cancelRequested, setCancelRequested] = useState(false);
  // Lu À LA FIN de l'envoi, dans la promesse : un état React y serait figé à sa
  // valeur du départ.
  const cancelRef = useRef(false);

  function choose(chosen: File | null | undefined) {
    if (!chosen) return;
    setError(null);
    setOutcome(null);
    setFile(chosen);
  }

  function discard() {
    setFile(null);
    setError(null);
  }

  function requestCancel() {
    cancelRef.current = true;
    setCancelRequested(true);
  }

  async function attempt(formData: FormData): Promise<Attempt> {
    const upload = await uploadDocument(formData);
    if ("error" in upload) {
      return cancelRef.current ? { kind: "cancelled", message: CANCELLED_BEFORE_DEPOSIT } : { kind: "refused", error: upload.error };
    }
    if (!cancelRef.current) return { kind: "deposited", versionId: upload.documentVersionId };
    const cancel = await cancelDocumentDeposit(upload.documentVersionId);
    if ("error" in cancel) return { kind: "cancel-failed", error: cancel.error };
    return {
      kind: "cancelled",
      message: describeCancelledDeposit({ side, validation: cancel.validation, notifiedCount: upload.notifiedCount }),
    };
  }

  // Rend `true` quand un dépôt est enregistré et conservé.
  async function send(formData: FormData): Promise<boolean> {
    const chosen = file;
    if (!chosen) return false;
    cancelRef.current = false;
    setCancelRequested(false);
    setError(null);
    setOutcome(null);
    let result: Attempt;
    try {
      // Rafraîchir l'affichage seulement quand une version RESTE : une annulation
      // réussie rafraîchit d'elle-même (revalidation côté serveur), un refus n'a rien
      // changé.
      result = await run(
        () => attempt(formData),
        (r) => r.kind === "deposited" || r.kind === "cancel-failed"
      );
    } catch {
      setError(SEND_FAILED);
      return false;
    } finally {
      setCancelRequested(false);
    }

    if (result.kind === "refused") {
      setError(result.error);
      return false;
    }
    setFile(null);
    if (result.kind === "cancelled") {
      setOutcome({ kind: "cancelled", message: result.message });
      return false;
    }
    if (result.kind === "cancel-failed") {
      setError(`${result.error} Le dépôt est resté en place.`);
      return true;
    }
    // Les pages de l'aperçu se préparent dès le dépôt : le premier « voir » tombe sur
    // le cache au lieu d'un lancement de Chromium.
    prepareDocumentPages(result.versionId, chosen.name);
    setOutcome({ kind: "deposited", versionId: result.versionId });
    return true;
  }

  const sending = phase === "running";
  return { file, error, outcome, phase, elapsedMs, busy, sending, cancelRequested, choose, discard, send, requestCancel };
}
