import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProspectForm } from "@/components/prospect/ProspectForm";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Nouveau prospect · EODA Conseil" };

export default async function NouveauProspectPage() {
  // Seule page commerciale qui ne lisait aucune donnée : elle s'affichait donc à un
  // CABINET_EVALUATOR qui tapait l'adresse (l'enregistrement, lui, était refusé).
  // Le module est réservé à l'admin jusque dans ses formulaires vides.
  await requireCabinetAdminSession();

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="Nouveau prospect" backHref="/dashboard/cabinet/commercial/prospects" />
      <Card>
        <CardContent className="pt-6">
          <ProspectForm />
        </CardContent>
      </Card>
    </div>
  );
}
