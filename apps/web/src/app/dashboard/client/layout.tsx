import { ClientShell } from "@/components/layout/client/ClientShell";

// Coquille du portail client (en-tête, barre du bas sur mobile, menu du compte).
// Elle lit la structure par requireClientEstablishment() — la couche
// d'autorisation unique — et chaque page continue d'appeler la sienne.
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
