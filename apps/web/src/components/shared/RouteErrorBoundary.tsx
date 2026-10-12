"use client";

import { useEffect } from "react";
import { ErrorScreen, RetryButton } from "@/components/shared/ErrorScreen";

// Corps commun des `error.tsx` (frontières d'erreur Next, forcément client).
//
// Journalisation : l'erreur serveur est déjà écrite dans les journaux par Next,
// accompagnée de son `digest`. Ici on ne trace QUE ce digest (référence opaque),
// jamais `error.message` ni la pile : côté navigateur, la console est lisible par
// quiconque ouvre les outils de développement (engineering-conventions S9).
export function RouteErrorBoundary({
  error,
  reset,
  backHref,
  backLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  backHref: string;
  backLabel: string;
}) {
  useEffect(() => {
    console.error("Erreur d'affichage d'une page — référence :", error.digest ?? "sans référence");
  }, [error.digest]);

  return (
    <ErrorScreen
      kind="error"
      title="Cette page ne s'affiche pas"
      description="Un problème est arrivé de notre côté. Vos informations ne sont pas perdues. Essayez encore une fois."
      backHref={backHref}
      backLabel={backLabel}
      action={<RetryButton onRetry={reset} />}
      reference={error.digest}
    />
  );
}
