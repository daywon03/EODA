import { CommercialNav } from "@/components/layout/CommercialNav";

// Layout purement présentationnel : la sous-navigation du module commercial.
//
// AUCUN contrôle d'accès ici. Le module est réservé à CABINET_ADMIN, et c'est
// `requireCabinetAdminSession()` — appelé par chaque action et chaque lecture de page —
// qui l'applique. Un contrôle recopié dans un layout serait une seconde couche
// d'autorisation, donc deux règles qui divergeront (CLAUDE.md §5 bis).
export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <CommercialNav />
      {children}
    </div>
  );
}
