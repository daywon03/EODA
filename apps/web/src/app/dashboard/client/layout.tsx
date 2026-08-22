import { ClientNav } from "@/components/layout/ClientNav";

// Layout purement présentationnel : la barre d'onglets du portail client.
// AUCUN contrôle d'accès ici — il vit dans lib/auth/guards.ts, appelé par chaque
// page (requireClientEstablishment). Recopier une vérification dans un layout
// donnerait une deuxième couche d'autorisation, donc deux règles qui divergeront
// (CLAUDE.md §5 bis).
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="-mt-6 sm:-mt-8 mb-6 sm:mb-8">
        <ClientNav />
      </div>
      {children}
    </div>
  );
}
