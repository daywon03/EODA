"use client";

import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";

// La frontière est sous le layout du portail : la navigation reste affichée, et la
// personne peut changer de page sans recharger.
export default function CabinetError({
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
      backHref="/dashboard/cabinet"
      backLabel="Revenir à l'accueil"
    />
  );
}
