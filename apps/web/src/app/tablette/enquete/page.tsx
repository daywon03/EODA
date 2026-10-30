import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveTabletSession } from "@/lib/auth/guards";
import { tabletCan } from "@/lib/services/tablet-role-service";
import { getTabletAnonymousSurveyTemplates } from "@/lib/actions/anonymous-survey";
import { ANONYMOUS_SURVEY_NOTICE, LISTED_SURVEY_NOTICE } from "@/lib/services/anonymous-survey-service";
import { TabletSignOutButton } from "@/components/tablet/TabletSignOutButton";
import { TabletHeader, TabletMain } from "@/components/tablet/TabletHeader";
import { TabletSurvey } from "@/components/tablet/survey/TabletSurvey";

export const metadata: Metadata = { title: "Enquête de satisfaction", robots: { index: false, follow: false } };

// Enquête sur la tablette (anonyme le 21/10, liste des personnes le 22/10/2026). Même
// garde que l'accueil : appareil enregistré + salarié connecté avec son code ; sinon
// retour à l'accueil, qui dit quoi faire. L'action d'envoi revérifie la session. La
// liste des personnes vit dans le navigateur (TabletSurvey) : la page ne la voit pas.
export default async function TabletSurveyPage({ searchParams }: { searchParams: Promise<{ personne?: string | string[] }> }) {
  const session = await resolveTabletSession();
  // Identifiant de la liste locale de la tablette (arrivée depuis un contrat signé) :
  // la page le relaie sans le lire ni le garder.
  const personne = (await searchParams).personne;
  const initialPersonId = typeof personne === "string" && /^[\w-]{1,64}$/.test(personne) ? personne : null;
  if (!session) redirect("/tablette");
  const templates = await getTabletAnonymousSurveyTemplates();
  if (!templates) redirect("/tablette");

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TabletHeader structureName={session.establishmentName} aside={<TabletSignOutButton name={session.staffDisplayName} />} />
      <TabletMain>
        <TabletSurvey
          templates={templates}
          establishmentId={session.establishmentId}
          structureName={session.establishmentName}
          listedNotice={LISTED_SURVEY_NOTICE}
          anonymousNotice={ANONYMOUS_SURVEY_NOTICE}
          initialPersonId={initialPersonId}
          canManage={tabletCan(session.tabletRole, "ROSTER")}
        />
      </TabletMain>
    </div>
  );
}
