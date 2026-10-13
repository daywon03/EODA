import type { QuizBoard } from "@/lib/actions/staff-quiz";
import type { QuizStatus } from "@/lib/services/quiz-status-service";
import { QUIZ_PILLS, type PillSpec } from "@/lib/design/status-vocabulary";
import { formatDate } from "@/lib/services/date-format-service";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import { StaffAddDialog } from "./StaffAddDialog";
import { StaffImportDialog } from "./StaffImportDialog";
import { SendQuizDialog } from "./SendQuizDialog";
import { ExportSignoffButton } from "./ExportSignoffButton";
import { StaffLeftButton } from "./StaffLeftButton";

const PILL_BY_STATUS: Record<QuizStatus, PillSpec> = {
  A_JOUR: QUIZ_PILLS.reussi,
  A_REFAIRE: QUIZ_PILLS.aRefaire,
  PAS_FAIT: QUIZ_PILLS.pasFait,
};

// ─────────────────────────────────────────────────────────────────────────────
// ÉQUIPE ET QUIZ — rendu partagé (onglet « Équipe et formations » de la fiche,
// « Mon équipe » du portail client). Maquettes Portail Cabinet v2 / espace d'une
// structure (A4) : tuiles « x / N à jour » par quiz, puis la matrice personne × quiz
// en pastilles (glyphe + mot, jamais la couleur seule). La matrice défile dans son
// propre cadre sur petit écran, jamais la page.
// Les gestes n'apparaissent que si la garde d'écriture passe (board.canWrite) ; les
// actions les revérifient de toute façon.
// ─────────────────────────────────────────────────────────────────────────────
export function QuizBoardView({ board, large = false }: { board: QuizBoard; large?: boolean }) {
  const count = board.rows.length;
  const staffChoices = board.rows.map((row) => ({ id: row.staff.id, name: row.staff.displayName }));

  return (
    <div className={cn("flex flex-col gap-5", large && "text-[17px]")}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-lg font-bold">
          {board.ownOnly ? "Vos quiz" : `${count} personne${count > 1 ? "s" : ""} dans l'équipe`}
        </p>
        <p className="text-ink2">· Rappel tous les 6 mois</p>
        <span className="flex-1" />
        {board.canWrite && (
          <>
            <StaffAddDialog establishmentId={board.establishmentId} />
            <StaffImportDialog establishmentId={board.establishmentId} />
          </>
        )}
        <ExportSignoffButton establishmentId={board.establishmentId} />
        {board.canWrite && count > 0 && (
          <SendQuizDialog
            establishmentId={board.establishmentId}
            modules={board.modules.map((m) => ({ code: m.code, title: m.title }))}
            staff={staffChoices}
            preselection={board.preselection}
          />
        )}
      </div>

      {board.modules.some((m) => m.provisional) && (
        <p className="rounded-lg border border-line bg-card px-4 py-3 text-ink2">
          Questions provisoires, en cours de validation par EODA.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {board.tiles.map((tile) => {
          const pct = tile.total === 0 ? 0 : Math.round((tile.upToDate / tile.total) * 100);
          return (
            <li key={tile.code} className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
              <span className="font-bold">{tile.title}</span>
              <span className="text-[26px] font-bold leading-tight tabular-nums">
                {tile.upToDate} / {tile.total}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className="block h-full bg-accent-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="text-ink2">
                {tile.total === 0
                  ? "Personne dans l'équipe"
                  : tile.upToDate === tile.total
                    ? "Toute l'équipe est à jour"
                    : `${tile.total - tile.upToDate} à faire ou à refaire`}
              </span>
            </li>
          );
        })}
      </ul>

      {count === 0 ? (
        <p className="rounded-xl border border-line bg-card px-4 py-6 text-ink2">
          {board.ownOnly
            ? "Votre fiche n'est pas encore reliée à votre compte. Demandez-le à votre responsable."
            : "Personne dans l'équipe pour l'instant. Ajoutez une personne ou importez une liste."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card" tabIndex={0} role="region" aria-label="Quiz par personne">
          <table className="w-full min-w-[960px] border-collapse">
            <caption className="sr-only">Statut des quiz de sensibilisation, par personne</caption>
            <thead className="bg-soft">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Personne</th>
                {board.modules.map((m) => (
                  <th key={m.code} scope="col" className="px-3 py-3 text-left">{m.shortTitle}</th>
                ))}
                <th scope="col" className="px-3 py-3 text-left">Dernier passage</th>
                {board.canWrite && <th scope="col" className="px-3 py-3 text-left"><span className="sr-only">Gestes</span></th>}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <tr key={row.staff.id} className="border-t border-line">
                  <th scope="row" className="px-4 py-3 text-left font-normal">
                    <span className="block font-bold">{row.staff.displayName}</span>
                    <span className="text-ink2">{row.staff.jobTitle}</span>
                  </th>
                  {board.modules.map((m) => {
                    const cell = row.cells[m.code];
                    return (
                      <td key={m.code} className="px-3 py-3">
                        {cell && <StatusPill pill={PILL_BY_STATUS[cell.status]} />}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-ink2">
                    {row.lastAttemptAt ? formatDate(row.lastAttemptAt) : "—"}
                  </td>
                  {board.canWrite && (
                    <td className="px-3 py-3">
                      <StaffLeftButton establishmentId={board.establishmentId} staffMemberId={row.staff.id} name={row.staff.displayName} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
