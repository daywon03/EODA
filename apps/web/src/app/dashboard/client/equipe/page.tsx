import { requireClientEstablishment } from "@/lib/auth/guards";
import { clientAllows, NEED } from "@/lib/auth/capabilities";
import { getQuizBoard, syncQuizRetestTasks } from "@/lib/actions/staff-quiz";
import { QuizBoardView } from "@/components/team-quiz/QuizBoardView";

export const metadata = { title: "Mon équipe" };

// « Mon équipe » du portail client (maquette de l'espace d'une structure, A4) — N10.
// Direction et responsable qualité : toute l'équipe et ses quiz ; intervenant : ses
// propres quiz seulement (la garde rend `ownOnly`). La structure vient du lien du
// compte, jamais de l'adresse.
export default async function ClientTeamPage() {
  const { establishment, accessRole, ownOnly } = await requireClientEstablishment(NEED.TEAM_READ);
  if (!establishment) {
    return (
      <div className="space-y-3">
        <h1 className="text-[30px] font-bold">Mon équipe</h1>
        <p>Aucune structure n&apos;est rattachée à votre compte.</p>
      </div>
    );
  }
  if (!ownOnly && accessRole && clientAllows(accessRole, NEED.TEAM_WRITE)) await syncQuizRetestTasks(establishment.id);
  const board = await getQuizBoard(establishment.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[30px] font-bold leading-tight">{ownOnly ? "Mes quiz" : "Mon équipe"}</h1>
        <p className="mt-1 max-w-[60ch] text-ink2">
          Des quiz courts pour sensibiliser l&apos;équipe : bientraitance, maltraitance, crise, hygiène, plaintes. Chaque
          quiz se refait tous les 6 mois.
        </p>
      </div>
      <QuizBoardView board={board} large />
    </div>
  );
}
