import Link from "next/link";
import { ChevronRight, FolderOpen, Library } from "lucide-react";
import { listTemplates } from "@/lib/actions/template-library";
import { requireCabinetSession } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TemplateForm } from "@/components/modeles/TemplateForm";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  TEMPLATE_CATEGORY_LABELS,
  TEMPLATE_STAGES,
  TEMPLATE_STAGE_LABELS,
} from "@/lib/services/template-library-service";
import { formatDate } from "@/lib/services/date-format-service";

export const metadata = { title: "Modèles EODA · EODA Conseil" };

// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE MODÈLES — les gabarits du cabinet.
//
// « Je ne pourrai pas garder tout ça sur mon PC à un moment donné » (call du 01/09).
//
// Lecture ouverte à tout le cabinet, création réservée à CABINET_ADMIN : publier une
// nouvelle version, c'est décider que tout le monde travaillera désormais dessus.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ModelesPage() {
  const { session } = await requireCabinetSession();
  const isAdmin = session.user.role === "CABINET_ADMIN";
  const templates = await listTemplates();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Modèles EODA"
        icon={Library}
        subtitle="Les gabarits du cabinet — vierges, reçus, produits. Aucun n'appartient à une structure."
      />

      {isAdmin && (
        <CollapsibleSection title="Ajouter un modèle" summary="nouvelle fiche">
          <TemplateForm />
        </CollapsibleSection>
      )}

      {templates.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm text-gris-mid">
            <p className="flex items-center gap-2 font-medium text-brun-ancre">
              <FolderOpen className="h-4 w-4 text-terre" aria-hidden="true" />
              La bibliothèque est vide.
            </p>
            <p>
              Créez une fiche par document — « Projet de service », « Livret d&apos;accueil » —
              puis déposez-y ses versions. Un même document peut porter sa version vierge, la
              version reçue de la structure et la version que vous avez produite.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => (
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
                        {TEMPLATE_CATEGORY_LABELS[template.category]} · mis à jour le{" "}
                        {formatDate(template.updatedAt)}
                      </p>
                      {/* Ce qui manque se lit ici : un modèle sans version vierge ne
                          sert à rien pour une nouvelle structure. */}
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
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-xs tabular-nums text-gris-mid">
                        {template.versionCount} version{template.versionCount !== 1 ? "s" : ""}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gris-mid" aria-hidden="true" />
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
