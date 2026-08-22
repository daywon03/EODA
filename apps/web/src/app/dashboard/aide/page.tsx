import { requireHelpAudience } from "@/lib/auth/guards";
import { listHelpArticles } from "@/lib/services/help-content-service";
import { HelpArticleList } from "@/components/help/HelpArticleList";
import { PageHeader } from "@/components/layout/PageHeader";
import { LifeBuoy } from "lucide-react";

export const metadata = { title: "Aide et guide · EODA Conseil" };

export default async function HelpCenterPage() {
  // Le rôle vient de la couche d'autorisation (relu en base), jamais du client :
  // c'est lui qui détermine les articles envoyés au navigateur.
  const { role } = await requireHelpAudience();
  const articles = listHelpArticles(role);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Aide et guide d'utilisation"
        subtitle="Comment faire, écran par écran. Ce guide sert aussi de support de formation."
        icon={LifeBuoy}
      />

      <HelpArticleList articles={articles} />

      <p className="text-xs text-gris-mid bg-ivoire border border-gris-light rounded-lg px-4 py-3">
        Outil de préparation interne EODA Conseil · Auto-évaluation préparatoire uniquement ·
        Non officiel HAS.
      </p>
    </div>
  );
}
