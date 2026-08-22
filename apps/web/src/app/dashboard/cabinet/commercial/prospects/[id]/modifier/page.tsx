import { getProspect } from "@/lib/actions/prospect";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProspectForm } from "@/components/prospect/ProspectForm";
import { Card, CardContent } from "@/components/ui/card";

type Props = { params: Promise<{ id: string }> };

export default async function ModifierProspectPage({ params }: Props) {
  const { id } = await params;
  const prospect = await getProspect(id);

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title={`Modifier — ${prospect.structureName}`} backHref={`/dashboard/cabinet/commercial/prospects/${id}`} />
      <Card>
        <CardContent className="pt-6">
          <ProspectForm prospect={prospect} />
        </CardContent>
      </Card>
    </div>
  );
}
