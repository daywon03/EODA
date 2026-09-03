import { Library } from "lucide-react";
import { getTemplate, listTemplateCategories } from "@/lib/actions/template-library";
import { requireCabinetSession } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { TemplateVersionUpload } from "@/components/modeles/TemplateVersionUpload";
import { TemplateDownloadLink } from "@/components/modeles/TemplateDownloadLink";
import { DeleteTemplateVersionButton } from "@/components/modeles/DeleteTemplateVersionButton";
import { DeleteTemplateButton } from "@/components/modeles/DeleteTemplateButton";
import { MoveTemplateForm } from "@/components/modeles/MoveTemplateForm";
import {
  TEMPLATE_KIND_HINTS,
  TEMPLATE_KIND_LABELS,
  TEMPLATE_STAGES,
  TEMPLATE_STAGE_HINTS,
  TEMPLATE_STAGE_LABELS,
} from "@/lib/services/template-library-service";
import { formatDate } from "@/lib/services/date-format-service";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: `${template.title} · Modèles EODA` };
}

// Un modèle et ses fichiers.
//
// DEUX PRÉSENTATIONS, parce qu'il y a deux natures de documents (call du 03/09) :
//  - un GABARIT se lit groupé par stade — vierge, initiale, finale. Le groupement
//    n'est pas cosmétique : c'est la comparaison entre l'état reçu et le résultat
//    produit qui donnera sa valeur à l'entraînement de l'IA.
//  - un DOCUMENT DE RÉFÉRENCE — le manuel HAS, un texte réglementaire — n'a pas de
//    stade. Lui en afficher trois, dont deux vides à jamais, annoncerait un travail
//    à faire qui n'existe pas.
export default async function ModelePage({ params }: Props) {
  const { id } = await params;
  const [{ session }, template, categories] = await Promise.all([
    requireCabinetSession(),
    getTemplate(id),
    listTemplateCategories(),
  ]);
  const isAdmin = session.user.role === "CABINET_ADMIN";
  const isReference = template.kind === "REFERENCE";

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={template.title}
        icon={Library}
        subtitle={`${template.categoryName} · ${TEMPLATE_KIND_LABELS[template.kind]}`}
        backHref="/dashboard/cabinet/modeles"
        action={
          isAdmin && template.versions.length === 0 ? (
            <DeleteTemplateButton templateId={template.id} title={template.title} />
          ) : undefined
        }
      />

      {template.description && (
        <Card>
          <CardContent className="pt-6 text-sm text-brun-ancre">
            <p className="whitespace-pre-wrap">{template.description}</p>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <>
          <CollapsibleSection
            title={isReference ? "Déposer un fichier" : "Publier une version"}
            summary="Word, Excel ou PDF"
            defaultOpen={template.versions.length === 0}
          >
            <TemplateVersionUpload templateId={template.id} kind={template.kind} />
          </CollapsibleSection>

          {/* « Que l'on puisse ensuite les réarranger » : le rangement se corrige
              depuis la fiche elle-même, là où on s'aperçoit qu'il est faux. */}
          <CollapsibleSection title="Ranger ce modèle" summary={template.categoryName}>
            <MoveTemplateForm
              templateId={template.id}
              categoryId={template.categoryId}
              categories={categories}
            />
          </CollapsibleSection>
        </>
      )}

      {isReference ? (
        <section className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-base font-semibold text-brun-ancre">Fichiers</h2>
            <span className="text-xs text-gris-mid">{TEMPLATE_KIND_HINTS.REFERENCE}</span>
          </div>
          <Card>
            <CardContent className="pt-6">
              <VersionList
                versions={template.versions}
                isAdmin={isAdmin}
                emptyLabel="Aucun fichier déposé."
                stageLabel={TEMPLATE_KIND_LABELS.REFERENCE}
                markCurrent={false}
              />
            </CardContent>
          </Card>
        </section>
      ) : (
        <div className="space-y-4">
          {TEMPLATE_STAGES.map((stage) => (
            <section key={stage} className="space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-base font-semibold text-brun-ancre">
                  {TEMPLATE_STAGE_LABELS[stage]}
                </h2>
                <span className="text-xs text-gris-mid">{TEMPLATE_STAGE_HINTS[stage]}</span>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <VersionList
                    versions={template.versions.filter((version) => version.stage === stage)}
                    isAdmin={isAdmin}
                    emptyLabel="Aucune version déposée à ce stade."
                    stageLabel={TEMPLATE_STAGE_LABELS[stage]}
                    markCurrent
                  />
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type VersionRow = Awaited<ReturnType<typeof getTemplate>>["versions"][number];

// Une seule liste pour les deux présentations : ce qui change entre un gabarit et un
// document de référence, c'est le GROUPEMENT, pas la façon d'afficher un fichier.
function VersionList({
  versions,
  isAdmin,
  emptyLabel,
  stageLabel,
  markCurrent,
}: {
  versions: VersionRow[];
  isAdmin: boolean;
  emptyLabel: string;
  stageLabel: string;
  markCurrent: boolean;
}) {
  if (versions.length === 0) {
    return <p className="text-sm text-gris-mid">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-gris-light">
      {versions.map((version, index) => {
        // Un document de référence peut n'avoir aucun millésime : le nom du fichier
        // reste alors la seule chose qui le désigne, et il vaut mieux que « null ».
        const heading = version.versionLabel ?? version.originalFilename;
        return (
          <li
            key={version.id}
            className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-brun-ancre">
                {heading}
                {/* La plus récente est marquée : sans repère, on ouvre la première de
                    la liste sans savoir si c'est celle qui fait foi. Un document de
                    référence n'a pas de « version courante » — il n'y a rien à
                    comparer. */}
                {markCurrent && index === 0 && <Badge>Version courante</Badge>}
              </p>
              {version.changeNote && (
                <p className="text-xs text-brun-ancre">{version.changeNote}</p>
              )}
              <p className="text-xs text-gris-mid">
                {version.originalFilename} · {formatFileSize(version.sizeBytes)} · déposé le{" "}
                {formatDate(version.createdAt)} par {version.uploadedByName}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <TemplateDownloadLink versionId={version.id} />
              {isAdmin && (
                <DeleteTemplateVersionButton
                  versionId={version.id}
                  versionLabel={heading}
                  stageLabel={stageLabel}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Taille lisible. Arrondie au dixième de Mo au-dessus d'un mégaoctet : « 1 348 576 o »
// ne dit rien à personne.
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
