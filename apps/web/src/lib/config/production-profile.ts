import type { AppEnv } from "./env";

// ─────────────────────────────────────────────────────────────────────────────
// PROFIL DE PRODUCTION — ce qu'une instance servant de vrais clients DOIT avoir
//
// Le socle (`getEnv()`) valide ce sans quoi l'application ne peut rien faire :
// base de données et secret de session. Il laisse volontairement optionnels le
// stockage S3, la clé Anthropic et l'URL publique, parce qu'en développement ces
// trois-là ont un repli légitime (disque local, adaptateur stub, hôte deviné).
//
// La frontière entre BLOQUANT et AVERTISSEMENT n'est pas « important / accessoire »,
// c'est : LE REPLI TRAHIT-IL SILENCIEUSEMENT ? Le disque local perd les documents au
// redéploiement sans rien dire — bloquant. Le stub d'analyse rend un résultat vide,
// visible à l'œil nu — avertissement.
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

  // Décision de Damon du 21/08/2026 : NON bloquant, pour ouvrir la plateforme avant
  // que l'analyse documentaire soit branchée. Le module 1 est la priorité V1, mais
  // l'espace client (module 2) a sa valeur sans lui : dépôt de documents, checklist
  // des pièces attendues, suivi des statuts, versioning.
  //
  // Ce qui rend l'assouplissement tenable au regard du critère ci-dessus : sans clé,
  // l'analyse rend un résultat VIDE, elle n'invente pas. Un manque non détecté se
  // voit ; une cotation fabriquée se serait retrouvée dans un livrable client. Le
  // jour où le module 1 est ouvert à Sandrine, cette règle redevient bloquante.
  if (!env.anthropic) {
    warnings.push(
      "Analyse documentaire non configurée (ANTHROPIC_API_KEY) : l'adaptateur stub ne produit AUCUNE analyse. Le dépôt de documents fonctionne, la détection des manques face au référentiel HAS non — ne pas présenter ce module à un client dans cet état."
    );
  }

  if (!env.resend) {
    warnings.push(
      // Formulation corrigée le 21/08/2026 : elle annonçait une journalisation, alors
      // que `getEmailPort()` LÈVE en production (lib/email/index.ts). Un avertissement
      // qui décrit un comportement que le code n'a pas est pire que pas d'avertissement.
      // Reste non bloquant sur décision de Damon (SMTP à brancher), mais dit la vérité.
      "Envoi d'email non configuré (RESEND_API_KEY / RESEND_FROM_EMAIL) : toute invitation client ou relance ÉCHOUERA en production — getEmailPort() lève, il n'y a pas de repli console hors développement."
    );
  }

  return warnings;
}
