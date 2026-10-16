// ─────────────────────────────────────────────────────────────────────────────
// STATUT DES QUIZ DE SENSIBILISATION — service PUR (lot B, tranche N10).
//
// Rien n'est stocké : « À jour / À refaire / Pas fait » se DÉRIVE des tentatives
// (append-only) et de `retestMonths` du module (CLAUDE.md §7 : l'état se dérive).
//   - À jour    : une tentative RÉUSSIE il y a moins de `retestMonths` mois ;
//   - À refaire : une réussite trop ancienne, ou des tentatives sans réussite ;
//   - Pas fait  : aucune tentative.
// La version du module n'entre pas dans le statut : une réussite sur la v1 reste
// « à jour » quand la v2 paraît, jusqu'à son échéance normale — la nouvelle version
// sera passée au prochain rappel. L'émargement garde, lui, la version passée.
// ─────────────────────────────────────────────────────────────────────────────

export type QuizStatus = "A_JOUR" | "A_REFAIRE" | "PAS_FAIT";

export type AttemptFacts = {
  staffMemberId: string;
  moduleCode: string;
  passed: boolean;
  completedAt: Date;
};

export type ModuleFacts = { code: string; retestMonths: number };

// Ajoute des mois de calendrier ; un 31 qui n'existe pas tombe au dernier jour du mois.
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

function latestPass(attempts: readonly AttemptFacts[]): Date | null {
  let latest: Date | null = null;
  for (const attempt of attempts) {
    if (attempt.passed && (!latest || attempt.completedAt > latest)) latest = attempt.completedAt;
  }
  return latest;
}

export type QuizCell = { status: QuizStatus; lastPassedAt: Date | null; dueOn: Date | null };

// Statut d'UNE personne pour UN module, à partir de SES tentatives sur ce module.
export function deriveQuizCell(attempts: readonly AttemptFacts[], retestMonths: number, now: Date): QuizCell {
  if (attempts.length === 0) return { status: "PAS_FAIT", lastPassedAt: null, dueOn: null };
  const lastPassedAt = latestPass(attempts);
  if (!lastPassedAt) return { status: "A_REFAIRE", lastPassedAt: null, dueOn: null };
  const dueOn = addMonths(lastPassedAt, retestMonths);
  return { status: dueOn > now ? "A_JOUR" : "A_REFAIRE", lastPassedAt, dueOn };
}

export type StaffFacts = { id: string; displayName: string; jobTitle: string };

export type QuizMatrixRow = {
  staff: StaffFacts;
  cells: Record<string, QuizCell>;
  lastAttemptAt: Date | null;
};

export function buildQuizMatrix(
  staff: readonly StaffFacts[],
  modules: readonly ModuleFacts[],
  attempts: readonly AttemptFacts[],
  now: Date
): QuizMatrixRow[] {
  return staff.map((member) => {
    const own = attempts.filter((a) => a.staffMemberId === member.id);
    const cells: Record<string, QuizCell> = {};
    for (const mod of modules) {
      cells[mod.code] = deriveQuizCell(
        own.filter((a) => a.moduleCode === mod.code),
        mod.retestMonths,
        now
      );
    }
    const lastAttemptAt = own.reduce<Date | null>((acc, a) => (!acc || a.completedAt > acc ? a.completedAt : acc), null);
    return { staff: member, cells, lastAttemptAt };
  });
}

// Tuile d'un module : « x / N à jour ».
export function countUpToDate(rows: readonly QuizMatrixRow[], moduleCode: string): { upToDate: number; total: number } {
  const upToDate = rows.filter((row) => row.cells[moduleCode]?.status === "A_JOUR").length;
  return { upToDate, total: rows.length };
}

// « Envoyer un quiz » : sont pré-cochés ceux qui doivent le faire ou le refaire —
// et ceux dont l'échéance tombe dans la fenêtre d'alerte.
export function preselectForCampaign(
  rows: readonly QuizMatrixRow[],
  moduleCode: string,
  now: Date,
  alertDays = RETEST_ALERT_DAYS
): string[] {
  const horizon = new Date(now.getTime() + alertDays * DAY_MS);
  return rows
    .filter((row) => {
      const cell = row.cells[moduleCode];
      if (!cell) return false;
      return cell.status !== "A_JOUR" || (cell.dueOn !== null && cell.dueOn <= horizon);
    })
    .map((row) => row.staff.id);
}

// Choix proposé à l'OUVERTURE de « Envoyer un quiz » : le premier quiz et sa
// présélection. Recalculé à chaque ouverture — figé au premier affichage, il oubliait
// les personnes ajoutées depuis (recette du 13/10/2026).
export function initialCampaignChoice(
  moduleCodes: readonly string[],
  preselection: Readonly<Record<string, readonly string[]>>
): { moduleCode: string; selected: string[] } {
  const moduleCode = moduleCodes[0] ?? "";
  return { moduleCode, selected: [...(preselection[moduleCode] ?? [])] };
}

// ── Alerte d'échéance (D12)──────────────────────────────────────────────────
// Les rappels dus dans les `alertDays` jours — ou déjà dépassés. Une personne qui
// n'a JAMAIS réussi n'est pas un « rappel » : elle est « pas fait / à refaire », et
// apparaît déjà comme telle dans la matrice et dans la présélection.
export const RETEST_ALERT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RetestDue = { staffMemberId: string; moduleCode: string; dueOn: Date };

export function listRetestsDue(rows: readonly QuizMatrixRow[], now: Date, alertDays = RETEST_ALERT_DAYS): RetestDue[] {
  const horizon = new Date(now.getTime() + alertDays * DAY_MS);
  const due: RetestDue[] = [];
  for (const row of rows) {
    for (const [moduleCode, cell] of Object.entries(row.cells)) {
      if (cell.dueOn && cell.dueOn <= horizon) due.push({ staffMemberId: row.staff.id, moduleCode, dueOn: cell.dueOn });
    }
  }
  return due.sort((a, b) => a.dueOn.getTime() - b.dueOn.getTime());
}

// Une tâche par MODULE (pas par personne). Le titre est la clé d'idempotence, avec la
// source QUIZ et « non faite » : il ne porte donc ni compteur (qui changerait) ni nom
// (jamais de donnée nominative dans un titre de tâche).
export function retestTaskTitle(moduleTitle: string): string {
  return `Faire refaire le quiz « ${moduleTitle} » aux personnes à rappeler`;
}

// Tâches à créer : un module en alerte sans tâche QUIZ ouverte de même titre.
export function retestTasksToCreate(
  due: readonly RetestDue[],
  moduleTitles: ReadonlyMap<string, string>,
  openQuizTaskTitles: ReadonlySet<string>
): { moduleCode: string; title: string; dueOn: Date }[] {
  const result: { moduleCode: string; title: string; dueOn: Date }[] = [];
  for (const [moduleCode, group] of groupRetestsByModule(due)) {
    const moduleTitle = moduleTitles.get(moduleCode);
    if (!moduleTitle) continue;
    const title = retestTaskTitle(moduleTitle);
    if (!openQuizTaskTitles.has(title)) result.push({ moduleCode, title, dueOn: group.earliest });
  }
  return result;
}

export function groupRetestsByModule(due: readonly RetestDue[]): Map<string, { count: number; earliest: Date }> {
  const groups = new Map<string, { count: number; earliest: Date }>();
  for (const item of due) {
    const current = groups.get(item.moduleCode);
    if (!current) groups.set(item.moduleCode, { count: 1, earliest: item.dueOn });
    else groups.set(item.moduleCode, { count: current.count + 1, earliest: item.dueOn < current.earliest ? item.dueOn : current.earliest });
  }
  return groups;
}
