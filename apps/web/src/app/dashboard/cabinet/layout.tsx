import { CabinetShell } from "@/components/layout/cabinet/CabinetShell";

// Coquille du portail cabinet (barre latérale, en-tête, fil d'Ariane). La garde
// est appelée DANS la coquille (requireCabinetSession) : un client est renvoyé vers
// son portail, un compte sans tenant vers la connexion. Chaque page et chaque
// action gardent leur propre garde — ce layout n'en remplace aucune.
export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  return <CabinetShell>{children}</CabinetShell>;
}
