import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// Configuration ESLint « flat » — remplace .eslintrc.json + `next lint`, déprécié et
// retiré dans Next.js 16. On appelle désormais l'ESLint CLI directement (`eslint .`),
// ce qui a deux avantages concrets au-delà de la dépréciation :
//   - le même binaire peut linter d'autres packages du monorepo (`next lint` ne
//     regardait que apps/web) ;
//   - `--max-warnings 0` garantit qu'aucun avertissement ne s'accumule silencieusement.
//
// eslint-config-next 15.5 ne publie pas encore de configuration flat : on la charge via
// FlatCompat, qui traduit l'ancien format. À retirer quand le paquet exportera du flat.

const here = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: here });

const config = [
  {
    ignores: [".next/**", "coverage/**", "next-env.d.ts", "node_modules/**"],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        // Indispensable aux règles qui ont besoin du type (no-floating-promises &
        // consorts) : sans information de type, elles se désactivent silencieusement.
        projectService: true,
        tsconfigRootDir: here,
      },
    },
    rules: {
      "react/no-unescaped-entities": "off",

      // ── S1 — aucune opération asynchrone non attendue ────────────────────────
      // Le meilleur retour sur investissement de toute la chaîne : une promesse non
      // attendue est un objet toujours vrai, donc un contrôle de sécurité qui passe
      // systématiquement sans qu'aucun type ni test ne le signale.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      // ── Typage sans échappatoire ─────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      // ── Pas de journalisation sauvage ────────────────────────────────────────
      "no-console": ["error", { allow: ["error", "warn"] }],

      // ── S6 — process.env lu à un seul endroit ────────────────────────────────
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "Ne pas lire process.env directement — importer la configuration validée depuis @/lib/config/env (cf. CLAUDE.md §0 et specs/02-architecture-technique.md §4.2, règle S6).",
        },
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']:not([parent.type='MemberExpression'])",
          message:
            "Ne pas lire process.env directement — importer la configuration validée depuis @/lib/config/env (cf. CLAUDE.md §0 et specs/02-architecture-technique.md §4.2, règle S6).",
        },
      ],
    },
  },

  // Seul module autorisé à lire process.env (règle S6).
  {
    files: ["src/lib/config/env.ts"],
    rules: { "no-restricted-syntax": "off" },
  },

  // Adaptateurs de repli développement : journaliser en console EST leur raison d'être
  // (aucun email réellement envoyé, aucune analyse LLM réellement faite).
  {
    files: ["src/lib/email/console-email-adapter.ts", "src/lib/llm/stub-analysis-adapter.ts"],
    rules: { "no-console": "off" },
  },

  // Fichiers de test : le typage strict s'y applique, mais on autorise les assertions
  // non nulles nécessaires pour vérifier une valeur derrière un `ok: true`.
  {
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },

  // Fichiers de configuration exécutés AVANT l'application (build Next.js, config
  // ESLint, config Vitest) : ils ne peuvent pas importer @/lib/config/env — l'alias
  // de chemin n'est pas résolu à ce stade et le module n'est pas encore chargé.
  // C'est la seule autre lecture de process.env légitime.
  {
    files: ["next.config.ts", "eslint.config.mjs", "vitest.config.mts"],
    rules: { "no-restricted-syntax": "off" },
  },
];

export default config;
