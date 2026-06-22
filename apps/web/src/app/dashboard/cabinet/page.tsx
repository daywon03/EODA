import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, ClipboardCheck, BarChart3 } from "lucide-react";

const MODULES = [
  {
    icon: FileText,
    title: "Analyse documentaire",
    description: "Vérification des documents obligatoires (loi 2002-2 / HAS)",
    status: "À venir — Jalon 3",
    color: "text-terre",
  },
  {
    icon: Users,
    title: "Espace client",
    description: "Gestion des établissements et suivi des dépôts",
    status: "À venir — Jalon 1",
    color: "text-ambre",
  },
  {
    icon: ClipboardCheck,
    title: "Auto-évaluation HAS",
    description: "Cotation des 137 critères Synaé (chapitres 1, 2, 3)",
    status: "À venir — Jalon 4",
    color: "text-brun-moyen",
  },
  {
    icon: BarChart3,
    title: "Tableau de bord",
    description: "Synthèse globale par établissement",
    status: "À venir",
    color: "text-gris-mid",
  },
];

export const metadata = { title: "Dashboard Cabinet · EODA Conseil" };

export default async function CabinetDashboardPage() {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");

  return (
    <div className="space-y-6">
      {/* En-tête de bienvenue */}
      <div className="border-l-4 border-terre pl-5 py-1">
        <h1 className="text-2xl font-bold text-brun-ancre">
          Tableau de bord Cabinet
        </h1>
        <p className="text-gris-mid text-sm mt-1">
          Bienvenue, {session.user.name ?? session.user.email} ·{" "}
          <span className="text-terre font-medium">
            {session.user.role === "CABINET_ADMIN" ? "Administrateur" : "Évaluateur"}
          </span>
        </p>
      </div>

      {/* Bandeau informatif */}
      <div className="bg-ambre/10 border border-ambre/30 rounded-lg px-5 py-4 text-sm text-brun-ancre">
        <strong className="text-brun-moyen">Jalon 0 complété.</strong>{" "}
        L&apos;authentification et la structure de la plateforme sont en place.
        Les modules métier seront disponibles à partir du Jalon 1.
      </div>

      {/* Cartes modules */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Card key={mod.title} className="opacity-80">
              <CardHeader className="pb-3">
                <Icon className={`w-6 h-6 mb-2 ${mod.color}`} />
                <CardTitle className="text-base">{mod.title}</CardTitle>
                <CardDescription className="text-xs">{mod.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-block text-xs bg-gris-light text-gris-mid px-2 py-0.5 rounded-full">
                  {mod.status}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
