import { EstablishmentForm } from "@/components/etablissement/EstablishmentForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Nouvel établissement · EODA Conseil" };

export default function NouvelEtablissementPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/cabinet">
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </Button>
        <div className="border-l-4 border-terre pl-4 py-0.5">
          <h1 className="text-xl font-bold text-brun-ancre">Nouvel établissement</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'établissement</CardTitle>
          <CardDescription>
            Ces informations serviront à personnaliser la checklist documentaire et le suivi
            de l'évaluation HAS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstablishmentForm />
        </CardContent>
      </Card>
    </div>
  );
}
