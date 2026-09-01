import { auth } from "@/auth";
import { getEstablishment } from "@/lib/actions/establishment";
import { getEstablishmentChecklist } from "@/lib/actions/checklist";
import { getMission } from "@/lib/actions/mission";
import { InviteClientForm } from "@/components/etablissement/InviteClientForm";
import { ClientUserRow } from "@/components/etablissement/ClientUserRow";
import { DeleteEstablishmentButton } from "@/components/etablissement/DeleteEstablishmentButton";
import { ChecklistCategory } from "@/components/checklist/ChecklistCategory";
import { MissionSummaryCard } from "@/components/mission/MissionSummaryCard";
import { EstablishmentLogoForm } from "@/components/etablissement/EstablishmentLogoForm";
import { AppointmentForm } from "@/components/agenda/AppointmentForm";
import { AppointmentList } from "@/components/agenda/AppointmentList";
import { listAppointmentsFor } from "@/lib/actions/appointment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatDate } from "@/lib/services/date-format-service";
import {
  Building2,
  Calendar,
  CalendarDays,
  FileBarChart,
  Image as ImageIcon,
  Pencil,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { EstablishmentType, DocumentCategory, StructureType } from "@eoda/database";
import { StageBadge } from "@/components/crm/StageBadge";
import {
  deriveFunnelStage,
  isAccompanimentStarted,
  isBetaMission,
} from "@/lib/services/lifecycle-service";
import { toMissionLifecycleFacts } from "@/lib/db/to-mission-lifecycle-facts";

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LOI_2002_2: "Documents loi 2002-2 (droits des personnes accompagnées)",
  FONCTIONNEMENT: "Fonctionnement de la structure",
  QUALITE_RISQUES: "Démarche qualité et gestion des risques",
  RH: "Ressources humaines",
};

const TYPE_LABELS: Record<EstablishmentType, string> = {
  SAD_AIDE: "SAD Aide",
  SAD_MIXTE: "SAD Mixte",
};

// Statut juridique — axe distinct du type SAD ci-dessus (CLAUDE.md §7).
const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  ASSOCIATION: "Association loi 1901",
  PUBLIC: "CCAS / CIAS",
  PRIVE: "Secteur privé",
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const establishment = await getEstablishment(id);
  return { title: `${establishment.name} · EODA Conseil` };
}

export default async function EstablishmentDetailPage({ params }: Props) {
  const { id } = await params;
  const establishment = await getEstablishment(id);
  const checklist = await getEstablishmentChecklist(id);
  const mission = await getMission(id);
  const appointments = await listAppointmentsFor({ establishmentId: id });
  const session = await auth();
  // Basculer un document entre « réclamé au client » et « produit par EODA » est une
  // politique de cabinet : réservée à CABINET_ADMIN, comme le catalogue.
  const isAdmin = session?.user.role === "CABINET_ADMIN";

  // Étape dérivée des faits, jamais d'un statut stocké (cf. lifecycle-service).
  const lifecycle = toMissionLifecycleFacts(establishment.mission);
  const stage = deriveFunnelStage({
    prospectStatus: establishment.prospect?.status ?? null,
    mission: lifecycle,
  });
  // Une fiche signée n'est pas encore un accompagnement : le diagnostic n'a pas
  // démarré, il n'y a donc rien à coter ni de checklist à suivre. Afficher ces
  // modules à ce stade donne l'illusion d'un travail en cours qui n'existe pas.
  const accompanimentStarted = isAccompanimentStarted(stage);

  const categories = Object.keys(CATEGORY_LABELS) as DocumentCategory[];
  const allItems = Object.values(checklist).flat();
  const totalItems = allItems.length;
  const missingCount = allItems.filter((i) => i.status === "MISSING").length;
  const compliantCount = allItems.filter((i) => i.status === "COMPLIANT").length;
  const uploadedCount = allItems.filter((i) =>
    ["UPLOADED", "ANALYZING", "INCOMPLETE", "COMPLIANT", "EXPIRED"].includes(i.status)
  ).length;
  const progressPct = totalItems > 0 ? Math.round((uploadedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={establishment.name}
        icon={Building2}
        backHref="/dashboard/cabinet"
        subtitle={establishment.finessNumber ? `FINESS ${establishment.finessNumber}` : undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{TYPE_LABELS[establishment.type]}</Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/cabinet/etablissements/${establishment.id}/modifier`}>
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                Modifier
              </Link>
            </Button>
            <DeleteEstablishmentButton
              establishmentId={establishment.id}
              establishmentName={establishment.name}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Infos établissement */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {establishment.address && (
              <p className="text-gris-mid">{establishment.address}</p>
            )}
            {establishment.hasEvaluationTargetDate && (
              <div className="flex items-center gap-2 text-brun-ancre">
                <Calendar className="w-4 h-4 text-terre flex-shrink-0" />
                <span>
                  Évaluation HAS cible :{" "}
                  <strong>
                    {formatDate(
                      new Date(establishment.hasEvaluationTargetDate)
                    )}
                  </strong>
                </span>
              </div>
            )}
            {/* Le badge affichait `commercialTier`, figé à BETA pour tout le monde :
                il annonçait « Bêta-test gratuit » à des clients payants. L'étape et
                la gratuité viennent maintenant des faits (mission, prospect). */}
            <div className="flex flex-wrap items-center gap-2">
              <StageBadge stage={stage} beta={isBetaMission(lifecycle)} />
              <Badge variant="secondary">{TYPE_LABELS[establishment.type]}</Badge>
              {establishment.structureType ? (
                <Badge variant="secondary">
                  {STRUCTURE_TYPE_LABELS[establishment.structureType]}
                </Badge>
              ) : (
                <Badge variant="not_applicable">Statut juridique non renseigné</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Interlocuteurs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-terre" />
              Interlocuteurs client
            </CardTitle>
            <CardDescription>
              {establishment.establishmentUsers.length === 0
                ? "Aucun interlocuteur côté client pour l'instant."
                : `${establishment.establishmentUsers.length} interlocuteur(s) rattaché(s)`}
            </CardDescription>
          </CardHeader>
          {establishment.establishmentUsers.length > 0 && (
            <CardContent>
              <ul className="divide-y divide-gris-light">
                {establishment.establishmentUsers.map(({ user, roleInEstablishment }) => (
                  <ClientUserRow
                    key={user.id}
                    establishmentId={establishment.id}
                    user={{
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      isActive: user.isActive,
                    }}
                    roleInEstablishment={roleInEstablishment}
                  />
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Suivi de mission */}
      {mission ? (
        <MissionSummaryCard
          establishmentId={establishment.id}
          mission={{ formule: mission.formule, gratuit: mission.gratuit, globalPct: mission.progress.globalPct }}
        />
      ) : (
        <MissionSummaryCard establishmentId={establishment.id} mission={null} />
      )}

      {mission && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auto-évaluation HAS</CardTitle>
            <CardDescription>
              {accompanimentStarted
                ? "Cotation des critères par chapitre (1/2/3/4/★/NC/RI)"
                : "Disponible une fois le diagnostic engagé — cochez un premier item de la checklist de mission ou planifiez une phase."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accompanimentStarted ? (
              <Button size="sm" asChild>
                <Link href={`/dashboard/cabinet/etablissements/${establishment.id}/evaluation`}>
                  Ouvrir l&apos;auto-évaluation
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/dashboard/cabinet/etablissements/${establishment.id}/mission`}>
                  Démarrer le diagnostic
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Checklist documentaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist documentaire</CardTitle>
          <CardDescription>
            {compliantCount} conforme{compliantCount > 1 ? "s" : ""} · {uploadedCount} / {totalItems} déposé{uploadedCount > 1 ? "s" : ""} · {missingCount} manquant{missingCount > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gris-mid">
              <span>Taux de dépôt documentaire</span>
              <span className="tabular-nums">{progressPct}%</span>
            </div>
            <ProgressBar value={progressPct} colorClassName="bg-ambre" />
            <p className="text-xs text-gris-mid">
              % de documents fournis par le client — pas un taux de conformité (voir le
              détail par document ci-dessous).
            </p>
          </div>
          <div className="space-y-3">
            {categories.map((cat) => {
              const items = checklist[cat] ?? [];
              if (items.length === 0) return null;
              return (
                <ChecklistCategory
                  key={cat}
                  title={CATEGORY_LABELS[cat]}
                  items={items}
                  establishmentId={establishment.id}
                  canManageVersions
                  canEditScope={isAdmin}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Le rapport de mise en conformité — le livrable que le cabinet remet et que la
          structure archive. Seules les analyses RELUES y entrent. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileBarChart className="w-4 h-4 text-terre" aria-hidden="true" />
            Rapport de mise en conformité
          </CardTitle>
          <CardDescription>
            Ce qui manque, document par document, au regard des critères HAS rattachés.
            Les analyses non encore relues y figurent comme telles, sans leur contenu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" asChild>
            <a href={`/imprimer/rapport/${id}?auto=1`} target="_blank" rel="noopener noreferrer">
              <FileBarChart className="w-3.5 h-3.5" aria-hidden="true" />
              Éditer le rapport
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Identité visuelle de la structure — apposée sur les documents produits pour
          elle, à côté du logo EODA. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-terre" aria-hidden="true" />
            Logo de la structure
          </CardTitle>
          <CardDescription>
            Il figure sur les documents que la plateforme produit pour cette structure.
            Sans logo déposé, c&apos;est son nom qui est écrit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstablishmentLogoForm
            establishmentId={establishment.id}
            establishmentName={establishment.name}
            logoDataUri={establishment.logoDataUri}
          />
        </CardContent>
      </Card>

      {/* Agenda de la structure — les points programmés avec elle, et de quoi en
          poser un nouveau. Le client verra les mêmes créneaux sur son portail. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-terre" aria-hidden="true" />
            Rendez-vous
          </CardTitle>
          <CardDescription>
            Visio, sur site ou téléphone — la structure voit ces créneaux depuis son espace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <AppointmentList
            appointments={appointments}
            emptyMessage="Aucun rendez-vous programmé avec cette structure pour l'instant."
          />
          <div className="border-t border-gris-light pt-5">
            <AppointmentForm establishmentId={establishment.id} structureName={establishment.name} />
          </div>
        </CardContent>
      </Card>

      {/* Invitation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inviter un interlocuteur client</CardTitle>
          <CardDescription>
            Crée un compte d'accès à l'espace client. Le mot de passe temporaire généré sera
            affiché une seule fois — communiquez-le à l'interlocuteur par email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteClientForm establishmentId={establishment.id} />
        </CardContent>
      </Card>
    </div>
  );
}
