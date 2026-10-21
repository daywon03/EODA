// POLITIQUE DE CONNEXION À LA BASE — pure, sans dépendance, sans effet de bord.
//
// Le 16/10/2026, la page d'accueil cabinet a échoué, en développement comme en
// production, sur la même requête :
//
//   FATAL: (EMAXCONNSESSION) max clients reached in session mode
//   — max clients are limited to pool_size: 15
//
// Deux faits mesurés se cumulent :
//
//   1. `DATABASE_URL` vise le pooler Supabase en MODE SESSION (port 5432, vérifié dans
//      `.env.local`). Dans ce mode, chaque client occupe une connexion serveur pour la
//      durée de sa session, et le plafond est le `pool_size` du projet : 15. Il ne
//      s'élargit pas ; il se contourne (mode transaction, port 6543).
//
//   2. Sans paramètre, Prisma ouvre `nb_cpu_physiques × 2 + 1` connexions par PROCESSUS
//      — 21 sur le poste de développement (10 cœurs mesurés), et une par instance
//      serverless. Une seule page qui lance cinq requêtes en parallèle
//      (`getStructuresOverview`) en réclame cinq d'un coup. Deux ou trois clients
//      concurrents épuisent donc les quinze créneaux.
//
// Le poste et la production partagent la MÊME base (décision assumée, cf. CLAUDE.md §6) :
// ce que le poste consomme, la production ne l'a plus.
//
// Ce module borne donc le pool là où il se règle — à la construction du client — pour
// toutes les instances, et complète les paramètres qu'exige le mode transaction. Il ne
// RÉÉCRIT PAS le port : passer en 6543 est un choix d'infrastructure, qui doit se lire
// dans `DATABASE_URL` et se voir dans le journal de démarrage, jamais dans du code qui
// transforme une URL en silence.

/**
 * Connexions simultanées ouvertes par instance.
 *
 * 1 est la recommandation de Supabase pour Prisma derrière le pooler, et la seule valeur
 * qui tienne en serverless (autant d'instances que de requêtes concurrentes) comme sur le
 * poste. Les requêtes parallèles d'une même instance font alors la queue au lieu d'ouvrir
 * cinq connexions : plus lent de quelques dizaines de millisecondes, mais la page
 * s'affiche.
 */
export const DEFAULT_CONNECTION_LIMIT = 1;

/** Port du pooler Supavisor en mode transaction (mode session : 5432). */
export const TRANSACTION_POOLER_PORT = "6543";

export type DatabaseUrlResolution = {
  /** URL à donner à Prisma. Inchangée si elle n'est pas analysable. */
  readonly url: string;
  /** Paramètres ajoutés, dans l'ordre — de quoi dire au démarrage ce qui a été corrigé. */
  readonly applied: readonly string[];
  /**
   * Vrai si l'URL vise le pooler Supabase en mode SESSION : un plafond de 15 clients,
   * partagé entre le poste, les prévisualisations et la production. Ce n'est pas une
   * erreur d'URL, c'est un manque à gagner d'infrastructure — donc un avertissement au
   * démarrage, pas un refus de servir.
   */
  readonly sessionModePooler: boolean;
  /** Faux si l'URL n'a pas pu être analysée (elle est rendue telle quelle). */
  readonly parsed: boolean;
};

/**
 * Borne le pool et complète les paramètres du pooler, sans rien écraser : un
 * `connection_limit` déjà écrit dans l'URL est un choix explicite, il gagne.
 */
export function resolveRuntimeDatabaseUrl(
  raw: string,
  connectionLimit: number = DEFAULT_CONNECTION_LIMIT
): DatabaseUrlResolution {
  const trimmed = raw.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Une URL illisible fera échouer Prisma de toute façon, avec son propre message.
    // Lever ici transformerait une erreur de configuration en plantage à l'import du
    // module — y compris pour les scripts qui n'ont rien à voir avec la base.
    return { url: trimmed, applied: [], sessionModePooler: false, parsed: false };
  }

  const applied: string[] = [];

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", String(connectionLimit));
    applied.push(`connection_limit=${connectionLimit}`);
  }

  // Mode transaction du pooler (Supavisor, port 6543) : Prisma DOIT désactiver ses
  // requêtes préparées, qu'un pooler de transaction ne peut pas garantir d'une requête à
  // l'autre. L'oublier ne se voit pas au démarrage mais à la première collision
  // (« prepared statement already exists »).
  if (url.port === TRANSACTION_POOLER_PORT && !url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
    applied.push("pgbouncer=true");
  }

  return {
    url: url.toString(),
    applied,
    sessionModePooler: isSessionModePooler(url),
    parsed: true,
  };
}

function isSessionModePooler(url: URL): boolean {
  return url.port === "5432" && url.hostname.endsWith(".pooler.supabase.com");
}

/** Message d'avertissement du démarrage, ou null si rien ne cloche. */
export function connectionPoolWarning(resolution: DatabaseUrlResolution): string | null {
  if (!resolution.sessionModePooler) return null;
  return (
    "base de données derrière le pooler Supabase en mode SESSION (port 5432, plafond " +
    "15 clients partagé avec la production). Une rafale de requêtes concurrentes peut " +
    "épuiser ces créneaux — erreur « max clients reached in session mode ». Remède : " +
    `pointer DATABASE_URL sur le port ${TRANSACTION_POOLER_PORT} (mode transaction), avec ` +
    "`?pgbouncer=true` ; garder le port 5432 pour DIRECT_URL (migrations)."
  );
}
