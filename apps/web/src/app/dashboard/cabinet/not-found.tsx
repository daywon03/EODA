import { ErrorScreen } from "@/components/shared/ErrorScreen";

// Rendu pour tout `notFound()` du portail cabinet — y compris un objet hors du
// périmètre du cabinet (CLAUDE.md §5 bis) : le texte ne dit donc jamais « vous
// n'avez pas accès », qui révélerait que l'élément existe ailleurs.
export default function CabinetNotFound() {
  return (
    <ErrorScreen
      kind="not-found"
      title="Cette page n'existe pas"
      description="L'élément a peut-être été supprimé, ou l'adresse est fausse."
      backHref="/dashboard/cabinet"
      backLabel="Revenir à l'accueil"
    />
  );
}
