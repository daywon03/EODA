import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveTabletSession } from "@/lib/auth/guards";
import { getTabletAnonymousSurveyTemplates } from "@/lib/actions/anonymous-survey";
import { ANONYMOUS_SURVEY_NOTICE } from "@/lib/services/anonymous-survey-service";
import { TabletSignOutButton } from "@/components/tablet/TabletSignOutButton";
import { TabletHeader, TabletMain } from "@/components/tablet/TabletHeader";
import { TabletAnonymousSurvey } from "@/components/tablet/TabletAnonymousSurvey";

export const metadata: Metadata = { title: "Enquête anonyme", robots: { index: false, follow: false } };

// Enquête ANONYME sur la tablette (21/10/2026). Même garde que l'accueil : appareil
// enregistré + salarié connecté avec son code ; sinon retour à l'accueil, qui dit
// quoi faire. L'action d'envoi revérifie la session.
export default async function TabletSurveyPage() {
  const session = await resolveTabletSession();
  if (!session) redirect("/tablette");
  const templates = await getTabletAnonymousSurveyTemplates();
  if (!templates) redirect("/tablette");

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TabletHeader structureName={session.establishmentName} aside={<TabletSignOutButton name={session.staffDisplayName} />} />
      <TabletMain>
        <TabletAnonymousSurvey templates={templates} notice={ANONYMOUS_SURVEY_NOTICE} />
      </TabletMain>
    </div>
  );
}
