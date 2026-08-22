import { EstablishmentForm } from "@/components/etablissement/EstablishmentForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Building2 } from "lucide-react";

export const metadata = { title: "Nouvel établissement · EODA Conseil" };

export default function NouvelEtablissementPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Nouvel établissement" icon={Building2} backHref="/dashboard/cabinet" />

      <Card>
        <CardHeader>
          <CardTitle>Informations de l&apos;établissement</CardTitle>
          <CardDescription>
            Ces informations serviront à personnaliser la checklist documentaire et le suivi
            de l&apos;évaluation HAS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstablishmentForm />
        </CardContent>
      </Card>
    </div>
  );
}
