import { ErrorScreen } from "@/components/shared/ErrorScreen";

// Sans titre, l'onglet d'une adresse inconnue portait le nom générique de
// l'application (vérification navigateur du 13/10).
export const metadata = { title: "Page introuvable" };

export default function RootNotFound() {
  return (
    <main className="min-h-screen bg-paper">
      <ErrorScreen
        kind="not-found"
        title="Cette page n'existe pas"
        description="L'adresse est peut-être fausse, ou la page a été déplacée."
        backHref="/"
        backLabel="Revenir à l'accueil"
      />
    </main>
  );
}
