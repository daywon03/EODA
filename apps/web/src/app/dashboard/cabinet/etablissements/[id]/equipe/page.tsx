import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { hasCabinetCapability } from "@/lib/auth/capabilities";
import { getQuizBoard, syncQuizRetestTasks } from "@/lib/actions/staff-quiz";
import { QuizBoardView } from "@/components/team-quiz/QuizBoardView";

export const metadata = { title: "Équipe et formations" };

type Props = { params: Promise<{ id: string }> };

// Onglet « Équipe et formations » de la fiche (maquette Portail Cabinet v2) — N10.
// Le libellé est celui de la maquette ; ce qui s'y suit est de la SENSIBILISATION
// (quiz), jamais une formation certifiante (context/11).
//
// L'alerte d'échéance (D12) est posée ICI, au chargement : une tâche QUIZ par module
// dont des rappels tombent dans les 30 jours, créée une seule fois (idempotente) et
// seulement pour un rôle qui écrit — la lecture seule regarde sans rien créer.
export default async function StructureTeamPage({ params }: Props) {
  const { id } = await params;
  const { role } = await requireEstablishmentInTenant(id, "READ");
  if (hasCabinetCapability(role, "STRUCTURES_WRITE")) await syncQuizRetestTasks(id);
  const board = await getQuizBoard(id);

  return (
    <section aria-labelledby="equipe-titre" className="space-y-4">
      <h2 id="equipe-titre" className="sr-only">
        Équipe et quiz de sensibilisation
      </h2>
      <QuizBoardView board={board} />
    </section>
  );
}
