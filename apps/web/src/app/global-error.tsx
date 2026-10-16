"use client";

import "./globals.css";
import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";

// Dernier filet : une erreur DANS le layout racine lui-même. Ce fichier REMPLACE
// alors le layout, d'où <html> et <body> déclarés ici et la feuille de style
// importée directement — rien de ce que le layout apporte n'est disponible.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-paper">
        <main>
          <RouteErrorBoundary
            error={error}
            reset={reset}
            backHref="/"
            backLabel="Revenir à l'accueil"
          />
        </main>
      </body>
    </html>
  );
}
