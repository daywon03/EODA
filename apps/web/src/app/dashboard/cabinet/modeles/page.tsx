import Link from "next/link";
import { ChevronRight, FolderOpen, Library } from "lucide-react";
import { listLibrary, listTemplateCategories } from "@/lib/actions/template-library";
import { requireCabinetSession } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TemplateForm } from "@/components/modeles/TemplateForm";
import { CategoryManager } from "@/components/modeles/CategoryManager";
import { FolderImport } from "@/components/modeles/FolderImport";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  TEMPLATE_STAGES,
  TEMPLATE_STAGE_LABELS,
} from "@/lib/services/template-library-service";
import { formatDate } from "@/lib/services/date-format-service";

export const metadata = { title: "Modèles EODA · EODA Conseil" };

// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE MODÈLES — les gabarits du cabinet, et sa base de connaissances.
//
// « Je ne pourrai pas garder tout ça sur mon PC à un moment donné » (call du 01/09),
// puis « il faudrait que l'on puisse mettre des dossiers facilement, et que les
// fichiers à l'intérieur se mettent tout seuls » (call du 03/09).
//
// L'écran est donc une ARBORESCENCE : des dossiers créés à la main, dans l'ordre du
// déroulé d'une mission, et les fiches dedans. Lecture ouverte à tout le cabinet,
// écriture réservée à CABINET_ADMIN : publier une nouvelle version, c'est décider que
// tout le monde travaillera désormais dessus.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ModelesPage() {
  // Trois lectures indépendantes : elles partent ensemble. En série, l'écran attend
  // trois allers-retours de base au lieu d'un.
  const [{ session }, folders, categories] = await Promise.all([
    requireCabinetSession(),
    listLibrary(),
    listTemplateCategories(),
  ]);
  const isAdmin = session.user.role === "CABINET_ADMIN";
  const templateCount = folders.reduce((total, folder) => total + folder.templates.length, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Modèles EODA"
        icon={Library}
        subtitle="Les gabarits du cabinet et ses documents de référence. Aucun n'appartient à une structure."
      />

      {isAdmin && (
        <>
          {/* L'import de dossier est en tête et ouvert : c'est le geste qui fait
              entrer une bibliothèque entière, les autres remplissent une ligne. */}
          <CollapsibleSection
            title="Importer un dossier"
            summary="depuis votre poste"
            defaultOpen={templateCount === 0}
          >
            <FolderImport />
          </CollapsibleSection>

          <CollapsibleSection title="Ajouter un modèle" summary="une fiche à la fois">
            <TemplateForm categories={categories} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Organiser les dossiers"
            summary={`${categories.length} dossier${categories.length !== 1 ? "s" : ""}`}
          >
            <CategoryManager categories={categories} />
          </CollapsibleSection>
        </>
      )}

      {templateCount === 0 ? (
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-gris-mid">
            <p className="flex items-center gap-2 font-medium text-brun-ancre">
              <FolderOpen className="h-4 w-4 text-terre" aria-hidden="true" />
              La bibliothèque est vide.
            </p>
            <p>
              Le plus rapide : importez un dossier de votre poste — chaque sous-dossier
              devient une fiche, et vous relisez le rangement proposé avant que quoi que
              ce soit ne soit enregistré.
            </p>
            <p>
              Sinon, créez une fiche par document — « Projet de service », « Livret
              d&apos;accueil » — puis déposez-y ses versions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {folders
            // Un dossier vide n'a rien à montrer ici : il reste gérable dans
            // « Organiser les dossiers », où son compteur à zéro a un sens.
            .filter((folder) => folder.templates.length > 0)
            .map((folder) => (
              <section key={folder.id} className="space-y-2">
                <h2 className="flex items-baseline gap-2 text-base font-semibold text-brun-ancre">
                  {folder.name}
                  <span className="text-xs font-normal text-gris-mid">
                    {folder.templates.length} modèle{folder.templates.length !== 1 ? "s" : ""}
                  </span>
                </h2>

                <ul className="space-y-3">
                  {folder.templates.map((template) => (
                    <li key={template.id}>
                      <Link
                        href={`/dashboard/cabinet/modeles/${template.id}`}
                        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-offset-2"
                      >
                        <Card className="border-l-4 border-l-terre transition-all duration-150 hover:-translate-y-0.5 hover:shadow-eoda-md">
                          <div className="flex items-start justify-between gap-3 p-4">
                            <div className="min-w-0 space-y-1.5">
                              <p className="truncate text-sm font-semibold text-brun-ancre">
                                {template.title}
                              </p>
                              <p className="text-xs text-gris-mid">
                                mis à jour le {formatDate(template.updatedAt)}
                              </p>
                              {/* Ce qui manque se lit ici : un gabarit sans version
                                  vierge ne sert à rien pour une nouvelle structure.
                                  Un document de référence, lui, n'a pas de stade —
                                  lui afficher « version vierge manquante » serait
                                  réclamer un fichier qui n'existera jamais. */}
                              {template.kind === "REFERENCE" ? (
                                <Badge variant="secondary">Document de référence</Badge>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {TEMPLATE_STAGES.map((stage) =>
                                    template.stages.includes(stage) ? (
                                      <Badge key={stage} variant="secondary">
                                        {TEMPLATE_STAGE_LABELS[stage]}
                                      </Badge>
                                    ) : (
                                      <Badge key={stage} variant="not_applicable">
                                        {TEMPLATE_STAGE_LABELS[stage]} manquante
                                      </Badge>
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              <span className="text-xs tabular-nums text-gris-mid">
                                {template.versionCount} fichier
                                {template.versionCount !== 1 ? "s" : ""}
                              </span>
                              <ChevronRight className="h-4 w-4 text-gris-mid" aria-hidden="true" />
                            </div>
                          </div>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
