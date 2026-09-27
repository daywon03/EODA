import { ClientNav } from "@/components/layout/ClientNav";
import { getClientHasUnansweredMessage } from "@/lib/actions/message";
import { getClientNewDeliverablesCount } from "@/lib/actions/deliverables";

// Layout purement présentationnel : la barre d'onglets du portail client.
// AUCUN contrôle d'accès ici — il vit dans lib/auth/guards.ts, appelé par chaque
// page (requireClientEstablishment) ET par les deux lectures de pastille
// elles-mêmes. Recopier une vérification ici donnerait une deuxième couche
// d'autorisation, donc deux règles qui divergeront (CLAUDE.md §5 bis).
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  // Deux lectures indépendantes : en parallèle, pas en cascade.
  const [hasUnansweredMessage, newDeliverablesCount] = await Promise.all([
    getClientHasUnansweredMessage(),
    getClientNewDeliverablesCount(),
  ]);

  return (
    <div>
      <div className="-mt-6 sm:-mt-8 mb-6 sm:mb-8">
        <ClientNav
          hasUnansweredMessage={hasUnansweredMessage}
          newDeliverablesCount={newDeliverablesCount}
        />
      </div>
      {children}
    </div>
  );
}
