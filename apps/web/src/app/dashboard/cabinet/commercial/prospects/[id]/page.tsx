import Link from "next/link";
import { getProspect } from "@/lib/actions/prospect";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProspectStatusSelect } from "@/components/prospect/ProspectStatusSelect";
import { DeleteProspectButton } from "@/components/prospect/DeleteProspectButton";
import { DevisCard } from "@/components/devis/DevisCard";
import { Pencil, Plus, Phone, Mail } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

const TYPE_LABELS = { ASSOCIATION: "Association", PRIVE: "Privé", PUBLIC: "Public" } as const;
const FORMULE_LABELS = { BETA: "Bêta", ESSENTIEL: "Essentiel", PERFORMANCE: "Performance", EXCELLENCE: "Excellence" } as const;

export default async function ProspectDetailPage({ params }: Props) {
  const { id } = await params;
  const prospect = await getProspect(id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={prospect.structureName}
        subtitle={TYPE_LABELS[prospect.structureType]}
        backHref="/dashboard/cabinet/commercial/prospects"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/cabinet/commercial/prospects/${id}/modifier`}>
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                Modifier
              </Link>
            </Button>
            <DeleteProspectButton prospectId={id} structureName={prospect.structureName} />
          </div>
        }
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gris-mid">Statut</span>
            <ProspectStatusSelect prospectId={id} status={prospect.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {prospect.contactName && <p><span className="text-gris-mid">Contact : </span>{prospect.contactName}</p>}
            {prospect.contactPhone && (
              <p className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gris-mid" aria-hidden="true" />
                {prospect.contactPhone}
              </p>
            )}
            {prospect.contactEmail && (
              <p className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-gris-mid" aria-hidden="true" />
                {prospect.contactEmail}
              </p>
            )}
            {prospect.envisagedFormule && (
              <p>
                <span className="text-gris-mid">Formule envisagée : </span>
                <Badge variant="secondary">{FORMULE_LABELS[prospect.envisagedFormule]}</Badge>
              </p>
            )}
            {prospect.estimatedAmountEuros != null && (
              <p><span className="text-gris-mid">Montant estimé : </span>{prospect.estimatedAmountEuros.toLocaleString("fr-FR")} €</p>
            )}
          </div>

          {prospect.needsAssessmentNotes && (
            <div className="border-t border-gris-light pt-3">
              <p className="text-xs text-gris-mid uppercase tracking-wide mb-1">Évaluation des besoins</p>
              <p className="text-sm text-brun-ancre whitespace-pre-wrap">{prospect.needsAssessmentNotes}</p>
            </div>
          )}

          {prospect.notes && (
            <div className="border-t border-gris-light pt-3">
              <p className="text-xs text-gris-mid uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-brun-ancre whitespace-pre-wrap">{prospect.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-brun-ancre">Devis</h2>
          <Button asChild size="sm">
            <Link href={`/dashboard/cabinet/commercial/devis/nouveau?prospectId=${id}`}>
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Nouveau devis
            </Link>
          </Button>
        </div>

        {prospect.devis.length === 0 ? (
          <p className="text-sm text-gris-mid">Aucun devis pour ce prospect.</p>
        ) : (
          <div className="space-y-3">
            {prospect.devis.map((d) => (
              <DevisCard
                key={d.id}
                id={d.id}
                number={d.number}
                status={d.status}
                formuleLabelSnapshot={d.formuleLabelSnapshot}
                totalAmountEuros={d.totalAmountEuros}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
