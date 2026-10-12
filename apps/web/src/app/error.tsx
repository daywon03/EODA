"use client";

import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";

// Frontière d'erreur de tout l'arbre sous le layout racine (connexion, impression,
// changement de mot de passe…). Les portails ont la leur, avec un retour adapté.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-paper">
      <RouteErrorBoundary error={error} reset={reset} backHref="/" backLabel="Revenir à l'accueil" />
    </main>
  );
}
