import type { AppEnv } from "./env";

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL DE PRODUCTION — ce qu'une instance servant de vrais clients DOIT avoir
//
// Le socle (`getEnv()`) valide ce sans quoi l'application ne peut rien faire :
// base de données et secret de session. Il laisse volontairement optionnels le
// stockage S3, la clé Anthropic et l'URL publique, parce qu'en développement ces
// trois-là ont un repli légitime (disque local, adaptateur stub, hôte deviné).
//
// Le défaut que ce module corrige : ces replis étaient refusés PARESSEUSEMENT,
// chacun dans son propre `getXxxPort()`, au premier appel réel. Un déploiement
// sans `S3_*` démarrait donc vert, servait les pages, et n'explosait qu'au
// premier dépôt de document — devant le client. Le contrôle appartient au
// démarrage, une fois, à un seul endroit.
//
// Fonction PURE : elle prend l'environnement déjà validé et rend la liste des
// problèmes. C'est ce qui la rend testable sans manipuler process.env.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_SECRET_LENGTH = 32;

export function productionConfigProblems(env: AppEnv): string[] {
  const problems: string[] = [];

  if (!env.s3) {
    problems.push(
      "Stockage fichiers non configuré : S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY sont requis en production (le repli disque local est réservé au développement). Bucket S3-compatible hébergé en Europe — cf. CLAUDE.md §6."
    );
  }

  if (!env.anthropic) {
    problems.push(
      "Analyse documentaire non configurée : ANTHROPIC_API_KEY est requis en production (l'adaptateur stub ne produit aucune analyse réelle)."
    );
  }

  if (!env.nextAuthUrl) {
    problems.push(
      "NEXTAUTH_URL est absent : Auth.js construit ses URLs de callback à partir de l'hôte vu derrière le reverse proxy, ce qui casse la connexion en production. Renseigner l'URL publique complète (https://…)."
    );
  } else if (!env.nextAuthUrl.startsWith("https://")) {
    problems.push(
      `NEXTAUTH_URL vaut "${env.nextAuthUrl}" : une URL https:// est attendue en production (le cookie de session porte l'attribut Secure).`
    );
  }

  // Déjà vérifié par getEnv(), revérifié ici pour que le rapport de démarrage soit
  // la liste complète et non un premier échec suivi d'un second au redémarrage.
  if (env.authSecret.length < MIN_SECRET_LENGTH) {
    problems.push(
      `AUTH_SECRET fait ${env.authSecret.length} caractères, minimum ${MIN_SECRET_LENGTH} attendu.`
    );
  }

  return problems;
}

// Non bloquants : l'application fonctionne sans, mais quelqu'un doit le savoir.
export function productionConfigWarnings(env: AppEnv): string[] {
  const warnings: string[] = [];

  if (!env.resend) {
    warnings.push(
      "Envoi d'email non configuré (RESEND_API_KEY / RESEND_FROM_EMAIL) : les invitations client et les relances seront journalisées au lieu d'être envoyées."
    );
  }

  return warnings;
}
