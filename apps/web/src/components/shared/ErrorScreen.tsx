import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN D'ERREUR / PAGE INTROUVABLE — partagé par tous les `error.tsx` et
// `not-found.tsx` de l'application.
//
// Règles (CLAUDE.md §6 accessibilité, FALC ; engineering-conventions S9) :
//   - phrases courtes, un seul message, une seule action principale ;
//   - JAMAIS le message technique ni la trace : `error.message` peut contenir un
//     fragment de requête, un identifiant d'un autre tenant ou un chemin serveur.
//     Next journalise déjà l'erreur côté serveur avec son `digest` ; l'écran ne
//     montre que ce `digest` (référence opaque) pour qu'on puisse la retrouver.
//   - Pas de <main> ici : sous /dashboard, les coquilles (CabinetShell, ClientShell)
//     le portent déjà ; les écrans racine l'ajoutent eux-mêmes.
//   - Server component : il ne reçoit pas de fonction. Le bouton « Réessayer »
//     est passé par l'appelant (`action`), qui est le seul composant client.
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  kind: "error" | "not-found";
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  // Bouton « Réessayer » (error.tsx uniquement).
  action?: ReactNode;
  reference?: string | undefined;
};

export function ErrorScreen({
  kind,
  title,
  description,
  backHref,
  backLabel,
  action,
  reference,
}: Props) {
  const Icon = kind === "error" ? AlertTriangle : SearchX;
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-soft">
        <Icon className="h-7 w-7 text-accent-text" aria-hidden="true" />
      </span>
      <h1 className="text-balance text-2xl font-bold text-ink">{title}</h1>
      <p className="max-w-prose text-base text-ink2">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {action}
        <Button variant="outline" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        </Button>
      </div>
      {reference && (
        <p className="text-sm text-ink2">
          Si le problème revient, donnez ce code à EODA :{" "}
          <span className="font-mono tabular-nums">{reference}</span>
        </p>
      )}
    </div>
  );
}

export function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <Button type="button" onClick={onRetry}>
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      Réessayer
    </Button>
  );
}
