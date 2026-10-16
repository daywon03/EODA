import type { Metadata } from "next";
import { openPublicQuiz } from "@/lib/actions/quiz-public";
import { PublicQuizRunner } from "@/components/quiz/PublicQuizRunner";
import { QuizRefusal } from "@/components/quiz/QuizRefusal";
import { EodaMark } from "@/components/layout/EodaLogo";

// Le jeton est dans l'adresse : aucun référent ne part vers un autre site, aucun
// moteur n'indexe la page.
export const metadata: Metadata = {
  title: "Quiz",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

// ─────────────────────────────────────────────────────────────────────────────
// QUIZ PAR QR CODE (N10) — la seule page publique nouvelle (middleware : chemin
// ANONYMOUS, testé dans lib/auth/routes.test.ts). Pensée pour un téléphone, en FALC :
// une question par écran, gros boutons, « Question N sur M », pictogramme + texte.
// Tout ce qui est affiché vient de openPublicQuiz, qui ne livre ni les bonnes
// réponses ni le nom de la personne.
// ─────────────────────────────────────────────────────────────────────────────
export default async function PublicQuizPage({ params }: Props) {
  const { token } = await params;
  const view = await openPublicQuiz(token);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-6 bg-paper px-4 py-6 text-[20px] leading-relaxed text-ink">
      <header className="flex items-center gap-3">
        <EodaMark size={44} className="flex-shrink-0" />
        <p className="font-bold">{view.state === "VALID" ? view.establishmentName : "Quiz de sensibilisation"}</p>
      </header>
      {view.state === "VALID" ? <PublicQuizRunner token={token} quiz={view.quiz} /> : <QuizRefusal state={view.state} />}
    </main>
  );
}
