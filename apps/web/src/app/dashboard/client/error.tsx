"use client";

import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";

// La frontière est sous le layout du portail : la navigation reste affichée, et la
// personne peut changer de page sans recharger.
export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      backHref="/dashboard/client"
      backLabel="Revenir à l'accueil"
    />
  );
}
