import { Download, FileCheck2 } from "lucide-react";
import { getContentReviewCatalog } from "@/lib/actions/content-review";
import { countReviewItems } from "@/lib/services/content-review-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ContentReviewFamily } from "@/components/content-review/ContentReviewFamily";

export const metadata = { title: "Contenus à valider" };

const EXPORT_PATH = "/api/export/contenus";

// ─────────────────────────────────────────────────────────────────────────────
// CONTENUS À VALIDER — lecture seule, CABINET_ADMIN et consultante (capacité
// CONTENT_REVIEW, garde dans getContentReviewCatalog). Tout le contenu provisoire de
// la plateforme, versionné, pour la relecture de Sandrine ; exportable en Word ou en
// CSV pour l'annoter hors ligne. Corriger un contenu se fait dans `content/`, en
// augmentant sa version — jamais depuis cet écran.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ContentReviewPage() {
  const catalog = await getContentReviewCatalog();
  const total = catalog.families.reduce((sum, family) => sum + countReviewItems(family), 0);

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Contenus à valider"
        subtitle={`${total} éléments provisoires, à valider par Sandrine`}
        icon={FileCheck2}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={`${EXPORT_PATH}?format=docx`} download>
                <Download className="h-4 w-4" aria-hidden="true" />
                Exporter en Word
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`${EXPORT_PATH}?format=csv`} download>
                <Download className="h-4 w-4" aria-hidden="true" />
                Exporter en CSV
              </a>
            </Button>
          </div>
        }
      />

      <Callout title="Lecture seule">
        Rien de ce qui est listé ici n&apos;a encore été relu. Exportez la liste, annotez-la, puis renvoyez vos corrections :
        chaque contenu corrigé change de version, et l&apos;ancienne version reste traçable.
      </Callout>

      <nav aria-label="Familles de contenus">
        <ul className="flex flex-wrap gap-2">
          {catalog.families.map((family) => (
            <li key={family.id}>
              <a
                href={`#famille-${family.id.toLowerCase()}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-semibold text-ink hover:border-accent-text/50 hover:bg-soft"
              >
                {family.title}
                <span className="tabular-nums text-ink2">{countReviewItems(family)}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {catalog.families.map((family) => (
        <ContentReviewFamily key={family.id} family={family} status={catalog.status} />
      ))}
    </div>
  );
}
