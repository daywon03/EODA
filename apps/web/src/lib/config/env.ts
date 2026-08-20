// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION — SEUL POINT DE LECTURE DE process.env (règle S6)
//
// Partout ailleurs on importe `getEnv()`. Une règle `no-restricted-syntax` dans
// .eslintrc.json fait échouer le lint sur toute autre lecture de process.env : la
// règle n'est pas un souhait écrit dans un document, elle est mécaniquement tenue.
//
// Pourquoi ce module existe : `process.env.AUTH_SECRET as string` ne valide rien.
// Une variable absente devient la chaîne "undefined", l'application démarre, paraît
// fonctionner, et signe ses jetons avec un secret constant et connu. Échouer vite et
// bruyamment est une fonctionnalité.
//
// Validation PARESSEUSE (au premier accès) et non à l'import du module, pour deux
// raisons concrètes :
//   - `next build` évalue les modules pendant la génération statique : une exception
//     à l'import ferait échouer le build sur une machine de CI qui n'a pas les
//     secrets de production ;
//   - le middleware tourne en Edge Runtime, où l'on veut contrôler ce qui est évalué.
// La validation reste donc déclenchée au premier appel réel, c'est-à-dire à la
// première requête, ce qui fait bien échouer un déploiement mal configuré.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_SECRET_LENGTH = 32;

export type AppEnv = {
  isProduction: boolean;
  isDevelopment: boolean;

  // Socle — toujours requis, l'application ne peut rien faire sans.
  databaseUrl: string;
  directUrl: string;
  authSecret: string;

  // URL publique de l'application, utilisée par Auth.js pour construire les URLs de
  // callback derrière le reverse proxy de l'hébergeur. Optionnelle au socle (Auth.js
  // sait s'en passer en local grâce à `trustHost`), mais EXIGÉE par le profil de
  // production — cf. production-profile.ts.
  nextAuthUrl: string | null;

  // Stockage fichiers S3-compatible, hébergé Europe. Absent = repli disque local
  // (développement uniquement) ; getFileStoragePort() refuse ce repli en production.
  s3: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  } | null;

  // Analyse documentaire IA. Absent = StubAnalysisAdapter (développement uniquement).
  anthropic: { apiKey: string; model: string | null } | null;

  // Envoi d'email. Absent = journalisation console (développement uniquement).
  resend: { apiKey: string; from: string } | null;
};

class ConfigurationError extends Error {
  constructor(problems: string[]) {
    super(
      `Configuration invalide — l'application ne peut pas démarrer :\n${problems
        .map((p) => `  - ${p}`)
        .join("\n")}\n\nVoir .env.example pour la liste complète des variables.`
    );
    this.name = "ConfigurationError";
  }
}

function readRequired(name: string, problems: string[]): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    problems.push(`${name} est absent ou vide.`);
    return "";
  }
  return value;
}

function readRequiredSecret(name: string, problems: string[]): string {
  const value = readRequired(name, problems);
  if (value && value.length < MIN_SECRET_LENGTH) {
    problems.push(
      `${name} fait ${value.length} caractères, minimum ${MIN_SECRET_LENGTH} attendu (générer avec : openssl rand -base64 32).`
    );
  }
  return value;
}

// Groupe optionnel : soit toutes les variables sont présentes, soit aucune. Une
// configuration partielle est une erreur, pas un repli silencieux — c'est le cas
// typique où l'on croit le stockage S3 actif alors qu'il écrit sur le disque local.
function readOptionalGroup(
  groupLabel: string,
  names: string[],
  problems: string[]
): Record<string, string> | null {
  const values = names.map((name) => ({ name, value: process.env[name]?.trim() || null }));
  const present = values.filter((v) => v.value !== null);

  if (present.length === 0) return null;
  if (present.length < names.length) {
    const missing = values.filter((v) => v.value === null).map((v) => v.name);
    problems.push(
      `${groupLabel} est partiellement configuré — variables manquantes : ${missing.join(", ")}. Renseigner le groupe entier ou le laisser entièrement vide.`
    );
    return null;
  }

  return Object.fromEntries(values.map((v) => [v.name, v.value!]));
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;

  const problems: string[] = [];

  const databaseUrl = readRequired("DATABASE_URL", problems);
  const directUrl = readRequired("DIRECT_URL", problems);
  const authSecret = readRequiredSecret("AUTH_SECRET", problems);

  const s3Group = readOptionalGroup(
    "Le stockage S3",
    ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    problems
  );
  const resendGroup = readOptionalGroup(
    "L'envoi d'email Resend",
    ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    problems
  );

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() || null;
  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim() || null;

  if (problems.length > 0) throw new ConfigurationError(problems);

  cached = {
    isProduction: process.env.NODE_ENV === "production",
    isDevelopment: process.env.NODE_ENV === "development",
    databaseUrl,
    directUrl,
    authSecret,
    nextAuthUrl,
    s3: s3Group
      ? {
          endpoint: s3Group.S3_ENDPOINT!,
          region: s3Group.S3_REGION!,
          bucket: s3Group.S3_BUCKET!,
          accessKeyId: s3Group.S3_ACCESS_KEY_ID!,
          secretAccessKey: s3Group.S3_SECRET_ACCESS_KEY!,
        }
      : null,
    anthropic: anthropicApiKey
      ? { apiKey: anthropicApiKey, model: process.env.ANTHROPIC_MODEL?.trim() || null }
      : null,
    resend: resendGroup
      ? { apiKey: resendGroup.RESEND_API_KEY!, from: resendGroup.RESEND_FROM_EMAIL! }
      : null,
  };

  return cached;
}

// Lecture de l'environnement d'exécution sans déclencher la validation complète —
// utile aux endroits qui ne veulent qu'un garde-fou « pas en production » (route de
// stockage local de développement) sans exiger toute la configuration.
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

// `next build` s'exécute avec NODE_ENV=production : sans ce discriminant, la
// validation du profil de production échouerait sur une machine de CI qui n'a
// légitimement aucun secret. Next.js positionne NEXT_PHASE pendant le build.
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

// `register()` d'instrumentation.ts est appelé une fois par runtime (Node.js ET Edge).
// Les contrôles de démarrage lisent la base : ils n'ont de sens que côté Node.
export function isNodeRuntime(): boolean {
  return process.env.NEXT_RUNTIME === "nodejs";
}
