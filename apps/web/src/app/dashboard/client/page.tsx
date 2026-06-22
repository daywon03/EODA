import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckSquare, Clock } from "lucide-react";

const SECTIONS = [
  {
    icon: Upload,
    title: "Dépôt de documents",
    description: "Déposez les documents demandés par votre consultant EODA",
    status: "À venir — Jalon 2",
    color: "text-terre",
  },
  {
    icon: CheckSquare,
    title: "Checklist documentaire",
    description: "Suivi des pièces attendues et de leur statut",
    status: "À venir — Jalon 1",
    color: "text-ambre",
  },
  {
    icon: Clock,
    title: "Historique",
    description: "Versions et historique de vos documents déposés",
    status: "À venir — Jalon 2",
    color: "text-gris-mid",
  },
];

export const metadata = { title: "Espace Client · EODA Conseil" };

export default async function ClientDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== "CLIENT_USER") redirect("/login");

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="border-l-4 border-ambre pl-5 py-1">
        <h1 className="text-2xl font-bold text-brun-ancre">Espace Client</h1>
        <p className="text-gris-mid text-sm mt-1">
          Bienvenue, {session.user.name ?? session.user.email}
        </p>
      </div>

      {/* Bandeau informatif */}
      <div className="bg-ambre/10 border border-ambre/30 rounded-lg px-5 py-4 text-sm text-brun-ancre">
        <strong className="text-brun-moyen">Votre espace est en cours de préparation.</strong>{" "}
        Votre consultant EODA vous informera dès que les fonctionnalités de dépôt de documents
        seront disponibles.
      </div>

      {/* Cartes fonctionnalités */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title} className="opacity-80">
              <CardHeader className="pb-3">
                <Icon className={`w-6 h-6 mb-2 ${s.color}`} />
                <CardTitle className="text-base">{s.title}</CardTitle>
                <CardDescription className="text-xs">{s.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-block text-xs bg-gris-light text-gris-mid px-2 py-0.5 rounded-full">
                  {s.status}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-gris-mid">
        Outil de préparation interne EODA Conseil · Non officiel HAS ·
        Accompagné traceur préparatoire uniquement
      </p>
    </div>
  );
}
