import type { Metadata } from "next";
import { openAnonymousSurveyLink } from "@/lib/actions/anonymous-survey";
import { ANONYMOUS_SURVEY_NOTICE } from "@/lib/services/anonymous-survey-service";
import { LinkSurveyRunner, SurveyLinkRefusal } from "@/components/survey/LinkSurveyRunner";
import { EodaMark } from "@/components/layout/EodaLogo";

// Le jeton est dans l'adresse : aucun référent ne part vers un autre site, aucun
// moteur n'indexe la page.
export const metadata: Metadata = {
  title: "Enquête de satisfaction",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// ENQUÊTE ANONYME PAR LIEN (21/10/2026) — route ANONYMOUS (classifyPath, testé).
// Pensée pour le téléphone d'une personne âgée ou d'un proche : une question par
// écran, gros boutons, aucune zone de texte. Ce qui s'affiche vient de
// openAnonymousSurveyLink : le nom de la structure et les questions, rien d'autre.
// ─────────────────────────────────────────────────────────────────────────────
export default async function AnonymousSurveyLinkPage({ params }: Props) {
  const { token } = await params;
  const view = await openAnonymousSurveyLink(token);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 bg-paper px-4 py-6 text-[20px] leading-relaxed text-ink">
      <header className="flex items-center gap-3">
        <EodaMark size={44} className="flex-shrink-0" />
        <p className="font-bold">{view.state === "VALID" ? view.establishmentName : "Enquête de satisfaction"}</p>
      </header>
      {view.state === "VALID" ? (
        <LinkSurveyRunner token={token} template={view.template} notice={ANONYMOUS_SURVEY_NOTICE} />
      ) : (
        <SurveyLinkRefusal state={view.state} />
      )}
    </main>
  );
}
