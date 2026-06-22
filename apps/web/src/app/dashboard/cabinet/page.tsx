import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listEstablishments } from "@/lib/actions/establishment";
import { EstablishmentCard } from "@/components/etablissement/EstablishmentCard";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";

export const metadata = { title: "Dashboard Cabinet · EODA Conseil" };

export default async function CabinetDashboardPage() {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");

  const establishments = await listEstablishments();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="border-l-4 border-terre pl-5 py-1">
          <h1 className="text-2xl font-bold text-brun-ancre">Tableau de bord Cabinet</h1>
          <p className="text-gris-mid text-sm mt-1">
            Bienvenue, {session.user.name ?? session.user.email}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/cabinet/etablissements/nouveau">
            <Plus className="w-4 h-4" />
            Nouvel établissement
          </Link>
        </Button>
      </div>

      {establishments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gris-light rounded-xl">
          <Building2 className="w-12 h-12 text-gris-light mb-4" />
          <h2 className="text-lg font-semibold text-brun-ancre mb-1">Aucun établissement</h2>
          <p className="text-gris-mid text-sm mb-6">
            Créez votre premier établissement pour commencer.
          </p>
          <Button asChild>
            <Link href="/dashboard/cabinet/etablissements/nouveau">
              <Plus className="w-4 h-4" />
              Créer ASSAD BENOIT
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {establishments.map((e) => (
            <EstablishmentCard
              key={e.id}
              id={e.id}
              name={e.name}
              finessNumber={e.finessNumber}
              type={e.type}
              hasEvaluationTargetDate={e.hasEvaluationTargetDate}
              documentCount={e._count.documents}
            />
          ))}
        </div>
      )}
    </div>
  );
}
