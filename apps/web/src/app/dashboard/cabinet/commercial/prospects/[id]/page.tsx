import Link from "next/link";
import { getProspect } from "@/lib/actions/prospect";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProspectStatusSelect } from "@/components/prospect/ProspectStatusSelect";
import { DeleteProspectButton } from "@/components/prospect/DeleteProspectButton";
import { ProspectTimeline } from "@/components/prospect/ProspectTimeline";
import { ProspectCommentForm } from "@/components/prospect/ProspectCommentForm";
import { DevisCard } from "@/components/devis/DevisCard";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";
import { AppointmentList } from "@/components/agenda/AppointmentList";
import { listAppointmentsFor } from "@/lib/actions/appointment";
import { FORMULE_LABELS } from "@/components/mission/formule-labels";
import { formatEuros } from "@/lib/services/price-format-service";
import {
  describeAcquisitionChannel,
  formatContactIdentity,
} from "@/lib/services/prospect-contact-service";
import { formatDate } from "@/lib/services/date-format-service";
import {
  describeStructureIdentityLine,
  ESTABLISHMENT_TYPE_LABELS,
} from "@/lib/services/structure-identity-service";
import {
  deriveProspectNextAction,
  describeProspectRelation,
  TIMELINE_ANCHOR,
} from "@/lib/services/prospect-next-action-service";
import { ClipboardList, Pencil, Plus, Phone, Mail, ArrowRight, Building2 } from "lucide-react";

type Props = { params: Promise<{ id: string }> };

const TYPE_LABELS = { ASSOCIATION: "Association", PRIVE: "Privé", PUBLIC: "Public" } as const;

export default async function ProspectDetailPage({ params }: Props) {
  const { id } = await params;
  const prospect = await getProspect(id);
  // R0, R1, R2 : les trois rendez-vous de vente se programment ici, avant qu'aucune
  // fiche client n'existe.
  const appointments = await listAppointmentsFor({ prospectId: id });

  // « À un moment donné, le titre prospect doit se transformer en client » : ce
  // moment est la conversion, c'est-à-dire l'existence d'une fiche — pas le statut
  // `SIGNE`, qui dit seulement qu'un devis a été signé.
  const relation = describeProspectRelation({
    status: prospect.status,
    establishmentId: prospect.establishmentId,
  });

  // Une seule action mise en avant par étape : l'écran présentait les mêmes boutons
  // partout, laissant se rappeler soi-même laquelle vient ensuite.
  const nextAction = deriveProspectNextAction({
    prospectId: id,
    status: prospect.status,
    // Le plus récent — `getProspect` trie déjà les devis du plus récent au plus ancien.
    latestDevisId: prospect.devis[0]?.id ?? null,
    establishmentId: prospect.establishmentId,
  });

  const contactIdentity = formatContactIdentity(prospect);
  const structureIdentity = describeStructureIdentityLine({
    finessNumber: prospect.finessNumber,
    address: prospect.address,
    establishmentType: prospect.establishmentType,
    hasEvaluationTargetDate: prospect.hasEvaluationTargetDate,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={prospect.structureName}
        subtitle={TYPE_LABELS[prospect.structureType]}
        backHref="/dashboard/cabinet/commercial/prospects"
        action={
          <div className="flex items-center gap-2">
            <RelationBadge relation={relation} />
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

      {nextAction && (
        <Card>
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gris-mid uppercase tracking-wide mb-1">Étape suivante</p>
              <p className="text-sm text-brun-ancre">{nextAction.hint}</p>
            </div>
            <Button asChild size="sm">
              <Link href={nextAction.href}>
                {nextAction.label}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gris-mid">Statut</span>
            <ProspectStatusSelect prospectId={id} status={prospect.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {contactIdentity && (
              <p><span className="text-gris-mid">Contact : </span>{contactIdentity}</p>
            )}
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
            <p>
              <span className="text-gris-mid">Canal : </span>
              {describeAcquisitionChannel(prospect)}
            </p>
            {prospect.envisagedFormule && (
              <p>
                <span className="text-gris-mid">Formule envisagée : </span>
                <Badge variant="secondary">{FORMULE_LABELS[prospect.envisagedFormule]}</Badge>
              </p>
            )}
            {prospect.estimatedAmountEuros != null && (
              <p><span className="text-gris-mid">Montant estimé : </span>{formatEuros(prospect.estimatedAmountEuros)}</p>
            )}
            {/* Identité de la structure, dès qu'on la connaît. Les champs absents ne
                s'affichent pas : « FINESS : — » a l'air d'un formulaire mal rempli,
                alors que c'est une information qu'on n'a pas encore. */}
            {structureIdentity && (
              <p><span className="text-gris-mid">Structure : </span>{structureIdentity}</p>
            )}
            {prospect.establishmentType && (
              <p>
                <span className="text-gris-mid">Type de SAD : </span>
                {ESTABLISHMENT_TYPE_LABELS[prospect.establishmentType]}
              </p>
            )}
            {prospect.hasEvaluationTargetDate && (
              <p>
                <span className="text-gris-mid">Échéance HAS visée : </span>
                {formatDate(prospect.hasEvaluationTargetDate)}
              </p>
            )}
          </div>

          {prospect.establishmentId && (
            <div className="border-t border-gris-light pt-3">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/cabinet/etablissements/${prospect.establishmentId}`}>
                  <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Ouvrir la fiche client
                </Link>
              </Button>
            </div>
          )}

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
          <div className="flex flex-wrap gap-2">
            {/* Parcours normal (§12.3) : l'offre et les options se cochent en séance,
                pendant la réunion d'évaluation des besoins. L'accès direct au devis
                reste là pour les cas où l'évaluation a déjà eu lieu. */}
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/cabinet/commercial/prospects/${id}/evaluation-besoins`}>
                <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
                Évaluation des besoins
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/cabinet/commercial/devis/nouveau?prospectId=${id}`}>
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Nouveau devis
              </Link>
            </Button>
          </div>
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

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-brun-ancre">Rendez-vous</h2>
        <Card>
          <CardContent className="pt-6 space-y-5">
            <AppointmentList
              appointments={appointments}
              emptyMessage="Aucun rendez-vous programmé. Posez le créneau du prochain échange — il apparaîtra dans votre agenda."
            />
            <div className="border-t border-gris-light pt-5">
              <AppointmentForm prospectId={id} structureName={prospect.structureName} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Le dossier : ce que Sandrine reconstituait jusqu'ici dans sa boîte mail. */}
      <div className="space-y-3" id={TIMELINE_ANCHOR}>
        <h2 className="text-base font-semibold text-brun-ancre">Historique</h2>
        <Card>
          <CardContent className="pt-6 space-y-5">
            <ProspectCommentForm prospectId={id} />
            <div className="border-t border-gris-light pt-4">
              <ProspectTimeline entries={prospect.timeline} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Le mot « prospect » reste juste sur l'écran de prospection ; il est faux sur la
// fiche d'une structure qui a signé.
function RelationBadge({ relation }: { relation: "PROSPECT" | "CLIENT" | "PERDU" }) {
  if (relation === "CLIENT") return <Badge>Client</Badge>;
  if (relation === "PERDU") return <Badge variant="secondary">Dossier perdu</Badge>;
  return <Badge variant="secondary">Prospect</Badge>;
}
