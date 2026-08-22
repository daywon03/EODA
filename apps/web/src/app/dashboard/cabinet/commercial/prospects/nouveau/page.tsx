import { PageHeader } from "@/components/layout/PageHeader";
import { ProspectForm } from "@/components/prospect/ProspectForm";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Nouveau prospect · EODA Conseil" };

export default function NouveauProspectPage() {
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
