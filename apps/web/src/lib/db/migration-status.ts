// ─────────────────────────────────────────────────────────────────────────────
// ÉTAT DES MIGRATIONS — comparaison entre ce que le code attend et ce que la base a
//
// Problème résolu : `pnpm db:migrate:deploy` ne tournait que dans la CI, contre une
// base jetable. Rien ne garantissait que la vraie base soit au niveau du code
// déployé. Une base en retard ne se manifeste pas au démarrage : elle se manifeste
// par une erreur Prisma « column does not exist » au milieu d'un dépôt de document.
//
// Ce module ne corrige pas la base (une application ne migre pas sa propre base à
// chaud), il rend l'écart VISIBLE au démarrage — cf. instrumentation.ts.
//
// La comparaison est une fonction pure, testable sans base : c'est la partie où se
// logent les erreurs de raisonnement (une migration en échec compte-t-elle comme
// appliquée ? une base en avance est-elle un problème ?).
// ─────────────────────────────────────────────────────────────────────────────

export type MigrationRow = {
  migrationName: string;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
};

export type MigrationStatus = {
  /** Attendues par le code, jamais appliquées avec succès. Base EN RETARD. */
  pending: string[];
  /** Présentes en base mais interrompues ou annulées. Base INCOHÉRENTE. */
  failed: string[];
  /** Appliquées en base mais inconnues du code. Base EN AVANCE (rollback applicatif). */
  unknown: string[];
};

function isSuccessfullyApplied(row: MigrationRow): boolean {
  return row.finishedAt !== null && row.rolledBackAt === null;
}

export function diffMigrations(
  expected: readonly string[],
  rows: readonly MigrationRow[]
): MigrationStatus {
  const applied = new Set(rows.filter(isSuccessfullyApplied).map((r) => r.migrationName));
  const expectedSet = new Set(expected);

  return {
    pending: expected.filter((name) => !applied.has(name)),
    failed: rows.filter((r) => !isSuccessfullyApplied(r)).map((r) => r.migrationName),
    unknown: [...applied].filter((name) => !expectedSet.has(name)).sort(),
  };
}

export function isSchemaUpToDate(status: MigrationStatus): boolean {
  return status.pending.length === 0 && status.failed.length === 0;
}

// Message unique et complet — une ligne de log bruyante vaut mieux que trois lignes
// partielles noyées dans le flux de démarrage.
export function describeMigrationStatus(status: MigrationStatus): string {
  const parts: string[] = [];
  if (status.failed.length > 0) {
    parts.push(`migrations en échec ou annulées : ${status.failed.join(", ")}`);
  }
  if (status.pending.length > 0) {
    parts.push(`migrations non appliquées : ${status.pending.join(", ")}`);
  }
  if (status.unknown.length > 0) {
    parts.push(
      `migrations présentes en base mais inconnues de cette version du code : ${status.unknown.join(", ")}`
    );
  }
  return parts.join(" · ");
}
