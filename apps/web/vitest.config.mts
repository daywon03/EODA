import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests unitaires sur les services purs uniquement (moteur de cotation HAS, périmètre
// des offres, validation des dépôts, parseurs d'entrée). Aucune base de données ni
// appel réseau : c'est précisément ce que la séparation services / actions rend
// possible (cf. CLAUDE.md §5).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Périmètre de couverture volontairement restreint aux modules PURS et
      // critiques. Mesurer la couverture de toute l'application produirait un
      // pourcentage bas et immobile, donc un seuil qu'on n'oserait jamais faire
      // échouer — c'est-à-dire un indicateur, pas un garde-fou.
      // On mesure là où le coût du défaut est le plus élevé : règles de cotation HAS
      // (un score faux se retrouve dans un livrable client), périmètre des offres
      // (un client verrait des critères non facturés), validation des dépôts et des
      // entrées (surface de sécurité).
      include: [
        "src/lib/services/scoring-service.ts",
        "src/lib/services/mission-progress-service.ts",
        "src/lib/services/mission-document-counters-service.ts",
        "src/lib/services/offer-scope-service.ts",
        "src/lib/services/document-status-service.ts",
        "src/lib/services/pre-rating-suggestion-service.ts",
        "src/lib/services/anonymization-service.ts",
        "src/lib/services/document-categorization-service.ts",
        "src/lib/services/devis-calculation-service.ts",
        "src/lib/services/price-format-service.ts",
        "src/lib/services/commercial-kpi-service.ts",
        "src/lib/config/production-profile.ts",
        "src/lib/db/migration-status.ts",
        "src/lib/security/password-policy.ts",
        "src/lib/security/upload-validation-service.ts",
        "src/lib/security/in-memory-rate-limiter.ts",
        "src/lib/security/login-throttle.ts",
        "src/lib/validation/form-parsers.ts",
      ],
      // Le seuil FAIT ÉCHOUER la commande (`vitest run --coverage`). Un seuil qui
      // n'échoue pas n'est pas un garde-fou. À relever au fur et à mesure, jamais à
      // baisser pour faire passer un build.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
