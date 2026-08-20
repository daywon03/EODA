import type { UserRole } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// CONTRAT DE CONTENU DU CENTRE D'AIDE
//
// Le contenu du guide est de la DOCUMENTATION, pas de l'interface : il vit dans
// des fichiers versionnés (ce dossier), jamais en base et jamais écrit en dur
// dans du JSX. Corriger une phrase = éditer un objet typé, sans toucher au rendu.
//
// Le périmètre de lecture d'un article est porté par `audiences` et arbitré
// CÔTÉ SERVEUR à partir du rôle relu en base (lib/auth/guards.ts) — jamais par
// un test de rôle côté client. Un article Cabinet ne doit jamais être envoyé au
// navigateur d'un CLIENT_USER (CLAUDE.md §7 : rien du pipeline commercial ne
// sort du cabinet).
// ─────────────────────────────────────────────────────────────────────────────

export type HelpCategory =
  | "PRISE_EN_MAIN"
  | "DOCUMENTS"
  | "MISSION"
  | "EVALUATION"
  | "COMMERCIAL";

export const HELP_CATEGORY_ORDER: readonly HelpCategory[] = [
  "PRISE_EN_MAIN",
  "DOCUMENTS",
  "MISSION",
  "EVALUATION",
  "COMMERCIAL",
];

export const HELP_CATEGORY_LABELS: Record<HelpCategory, string> = {
  PRISE_EN_MAIN: "Prise en main",
  DOCUMENTS: "Documents et checklist",
  MISSION: "Établissements et suivi de mission",
  EVALUATION: "Auto-évaluation HAS",
  COMMERCIAL: "Pipeline commercial (interne)",
};

// Blocs de rendu autorisés. Volontairement peu nombreux : un guide qui sert de
// support de formation doit rester lisible et homogène, pas devenir un éditeur
// de pages libre.
export type HelpBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "steps"; items: readonly string[] }
  | { kind: "list"; items: readonly string[] }
  | { kind: "note"; tone: "info" | "warning"; text: string };

export type HelpArticle = {
  /** Identifiant d'URL — stable, il finit dans les liens partagés en formation. */
  slug: string;
  title: string;
  /** Une phrase, affichée sur la carte de la liste. */
  summary: string;
  category: HelpCategory;
  audiences: readonly UserRole[];
  /** Où se trouve l'écran décrit, en langage d'utilisateur. */
  where: string;
  /** Mots-clés de recherche complémentaires (synonymes métier, sigles). */
  keywords: readonly string[];
  body: readonly HelpBlock[];
};

export const AUDIENCE_ALL: readonly UserRole[] = [
  "CABINET_ADMIN",
  "CABINET_EVALUATOR",
  "CLIENT_USER",
];

export const AUDIENCE_CABINET: readonly UserRole[] = ["CABINET_ADMIN", "CABINET_EVALUATOR"];

export const AUDIENCE_CABINET_ADMIN: readonly UserRole[] = ["CABINET_ADMIN"];
