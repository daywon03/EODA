import { getEstablishment } from "@/lib/actions/establishment";
import { EstablishmentForm } from "@/components/etablissement/EstablishmentForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Building2 } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const establishment = await getEstablishment(id);
  return { title: `Modifier ${establishment.name} · EODA Conseil` };
}

export default async function ModifierEtablissementPage({ params }: Props) {
  const { id } = await params;
  const establishment = await getEstablishment(id);

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={`Modifier ${establishment.name}`}
        icon={Building2}
        backHref={`/dashboard/cabinet/etablissements/${id}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Informations de l&apos;établissement</CardTitle>
          <CardDescription>
            Ces informations serviront à personnaliser la checklist documentaire et le suivi
            de l&apos;évaluation HAS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstablishmentForm establishment={establishment} />
        </CardContent>
      </Card>
    </div>
  );
}
