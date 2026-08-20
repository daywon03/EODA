import { notFound } from "next/navigation";
import { requireHelpAudience } from "@/lib/auth/guards";
import { findHelpArticle } from "@/lib/services/help-content-service";
import { HelpArticleBody } from "@/components/help/HelpArticleBody";
import { PageHeader } from "@/components/layout/PageHeader";
import { MapPin } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { role } = await requireHelpAudience();
  const article = findHelpArticle(slug, role);
  return { title: `${article ? article.title : "Aide"} · EODA Conseil` };
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params;
  const { role } = await requireHelpAudience();

  // notFound() et jamais redirect() : un article hors périmètre est indiscernable
  // d'un article inexistant, on ne révèle pas ce qui existe côté Cabinet.
  const article = findHelpArticle(slug, role);
  if (!article) notFound();

  return (
    <article className="space-y-6 max-w-3xl">
      <PageHeader title={article.title} subtitle={article.summary} backHref="/dashboard/aide" />

      <p className="flex items-start gap-2 text-sm text-brun-ancre bg-ivoire border border-gris-light rounded-lg px-4 py-3">
        <MapPin className="w-4 h-4 text-terre flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          <span className="font-semibold">Où : </span>
          {article.where}
        </span>
      </p>

      <div className="bg-white border border-gris-light rounded-xl p-5 sm:p-6">
        <HelpArticleBody blocks={article.body} />
      </div>
    </article>
  );
}
