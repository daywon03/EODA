import { ErrorScreen } from "@/components/shared/ErrorScreen";

// Rendu pour tout `notFound()` du portail client. Même règle que côté cabinet :
// jamais « vous n'avez pas accès », qui révélerait qu'un élément existe ailleurs.
export default function ClientNotFound() {
  return (
    <ErrorScreen
      kind="not-found"
      title="Cette page n'existe pas"
      description="L'adresse est peut-être fausse. Revenez à l'accueil pour retrouver vos documents."
      backHref="/dashboard/client"
      backLabel="Revenir à l'accueil"
    />
  );
}
