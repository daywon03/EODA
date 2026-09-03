import { Library } from "lucide-react";
import { getTemplate } from "@/lib/actions/template-library";
import { requireCabinetSession } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { TemplateVersionUpload } from "@/components/modeles/TemplateVersionUpload";
import { TemplateDownloadLink } from "@/components/modeles/TemplateDownloadLink";
import { DeleteTemplateVersionButton } from "@/components/modeles/DeleteTemplateVersionButton";
import { DeleteTemplateButton } from "@/components/modeles/DeleteTemplateButton";
import {
  TEMPLATE_CATEGORY_LABELS,
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

// Un modèle et ses versions, groupées par stade — vierge, initiale, finale. Le
// groupement n'est pas cosmétique : c'est la comparaison entre l'état reçu et le
// résultat produit qui donnera sa valeur à l'entraînement de l'IA, et une liste
// chronologique unique la rendrait illisible.
export default async function ModelePage({ params }: Props) {
  const { id } = await params;
  const { session } = await requireCabinetSession();
  const isAdmin = session.user.role === "CABINET_ADMIN";
  const template = await getTemplate(id);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={template.title}
        icon={Library}
        subtitle={TEMPLATE_CATEGORY_LABELS[template.category]}
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
        <CollapsibleSection
          title="Publier une version"
          summary="Word, Excel ou PDF"
          defaultOpen={template.versions.length === 0}
        >
          <TemplateVersionUpload templateId={template.id} />
        </CollapsibleSection>
      )}

      <div className="space-y-4">
        {TEMPLATE_STAGES.map((stage) => {
          const versions = template.versions.filter((version) => version.stage === stage);
          return (
            <section key={stage} className="space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-base font-semibold text-brun-ancre">
                  {TEMPLATE_STAGE_LABELS[stage]}
                </h2>
                <span className="text-xs text-gris-mid">{TEMPLATE_STAGE_HINTS[stage]}</span>
              </div>

              <Card>
                <CardContent className="pt-6">
                  {versions.length === 0 ? (
                    <p className="text-sm text-gris-mid">Aucune version déposée à ce stade.</p>
                  ) : (
                    <ul className="divide-y divide-gris-light">
                      {versions.map((version, index) => (
                        <li
                          key={version.id}
                          className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-brun-ancre">
                              {version.versionLabel}
                              {/* La plus récente est marquée : sans repère, on ouvre
                                  la première de la liste sans savoir si c'est celle
                                  qui fait foi. */}
                              {index === 0 && <Badge>Version courante</Badge>}
                            </p>
                            {version.changeNote && (
                              <p className="text-xs text-brun-ancre">{version.changeNote}</p>
                            )}
                            <p className="text-xs text-gris-mid">
                              {version.originalFilename} · {formatFileSize(version.sizeBytes)} ·
                              déposée le {formatDate(version.createdAt)} par{" "}
                              {version.uploadedByName}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-3">
                            <TemplateDownloadLink versionId={version.id} />
                            {isAdmin && (
                              <DeleteTemplateVersionButton
                                versionId={version.id}
                                versionLabel={version.versionLabel}
                                stageLabel={TEMPLATE_STAGE_LABELS[stage]}
                              />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Taille lisible. Arrondie au dixième de Mo au-dessus d'un mégaoctet : « 1 348 576 o »
// ne dit rien à personne.
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
