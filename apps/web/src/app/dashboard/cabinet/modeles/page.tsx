import { Library } from "lucide-react";
import { listLibrary, listTemplateCategories } from "@/lib/actions/template-library";
import { listCriteriaForPicker } from "@/lib/actions/document";
import { requireCabinetSession } from "@/lib/auth/guards";
import { PageHeader } from "@/components/layout/PageHeader";
import { TemplateCriterionFilter } from "@/components/modeles/TemplateCriterionFilter";
import { LibraryToolbar } from "@/components/modeles/LibraryToolbar";
import { LibraryBrowser } from "@/components/modeles/LibraryBrowser";

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
type Props = { searchParams: Promise<{ critere?: string }> };

export default async function ModelesPage({ searchParams }: Props) {
  const { critere } = await searchParams;

  // Quatre lectures indépendantes : elles partent ensemble. En série, l'écran
  // attend quatre allers-retours de base au lieu d'un.
  const [{ session }, folders, categories, allCriteria] = await Promise.all([
    requireCabinetSession(),
    listLibrary(critere),
    listTemplateCategories(),
    listCriteriaForPicker(),
  ]);
  const isAdmin = session.user.role === "CABINET_ADMIN";

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Bibliothèque"
        icon={Library}
        subtitle="Les gabarits du cabinet et ses sources HAS. Rien n'appartient à une structure."
        action={
          <div className="flex items-center gap-2">
            <TemplateCriterionFilter allCriteria={allCriteria ?? []} selectedCriterionId={critere} />
            {isAdmin && <LibraryToolbar categories={categories} />}
          </div>
        }
      />

      <LibraryBrowser folders={folders} hasCriterionFilter={Boolean(critere)} />
    </div>
  );
}
