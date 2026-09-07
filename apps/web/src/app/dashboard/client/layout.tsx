import { ClientNav } from "@/components/layout/ClientNav";
import { getClientHasUnansweredMessage } from "@/lib/actions/message";

// Layout purement présentationnel : la barre d'onglets du portail client.
// AUCUN contrôle d'accès ici — il vit dans lib/auth/guards.ts, appelé par chaque
// page (requireClientEstablishment) ET par getClientHasUnansweredMessage
// elle-même. Recopier une vérification ici donnerait une deuxième couche
// d'autorisation, donc deux règles qui divergeront (CLAUDE.md §5 bis).
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const hasUnansweredMessage = await getClientHasUnansweredMessage();

  return (
    <div>
      <div className="-mt-6 sm:-mt-8 mb-6 sm:mb-8">
        <ClientNav hasUnansweredMessage={hasUnansweredMessage} />
      </div>
      {children}
    </div>
  );
}
