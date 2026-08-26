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
        // Lecture du JSON d'analyse : c'est une entrée non fiable (colonne Json
        // écrite par un modèle, sous un contrat qui a pu changer). Un parseur trop
        // permissif afficherait une analyse vide comme un document sans reproche.
        "src/lib/services/analysis-view-service.ts",
        "src/lib/services/pre-rating-suggestion-service.ts",
        "src/lib/services/anonymization-service.ts",
        "src/lib/services/document-categorization-service.ts",
        "src/lib/services/devis-calculation-service.ts",
        "src/lib/services/devis-transition-service.ts",
        "src/lib/services/pagination-service.ts",
        "src/lib/services/price-format-service.ts",
        "src/lib/services/commercial-kpi-service.ts",
        "src/lib/services/help-content-service.ts",
        "src/lib/services/client-contract-service.ts",
        "src/lib/services/conversion-service.ts",
        // Cycle de vie d'une fiche client. Sous mesure parce que l'état est DÉRIVÉ :
        // une erreur ici n'échoue nulle part, elle affiche simplement une mauvaise
        // étape — un client « terminé » présenté comme « signé », un accompagnement
        // en cours annoncé comme non démarré.
        "src/lib/services/lifecycle-service.ts",
        "src/lib/db/to-mission-lifecycle-facts.ts",
        // Agrégats de portefeuille : même raison, un cran plus haut. Un client actif
        // mal compté ne fait échouer aucun test métier — il produit un chiffre faux
        // sur le tableau de bord, et personne ne remet en cause un compteur.
        "src/lib/services/portfolio-kpi-service.ts",
        "src/lib/db/to-portfolio-row.ts",
        // Dossier prospect : identité du contact, action suivante par étape, partage
        // du devis. Rien n'y échoue bruyamment — une civilité mal composée ou un
        // mauvais lien d'étape se voit seulement à l'écran, sur un document qui part
        // chez un client.
        "src/lib/services/prospect-contact-service.ts",
        "src/lib/services/prospect-next-action-service.ts",
        "src/lib/services/devis-sharing-service.ts",
        "src/lib/config/production-profile.ts",
        "src/lib/db/migration-status.ts",
        "src/lib/security/password-policy.ts",
        "src/lib/security/password-hashing.ts",
        "src/lib/security/attempt-throttle.ts",
        // La couche d'autorisation est le module dont un défaut coûte le plus cher
        // du dépôt (CLAUDE.md §5 bis : une seule couche, traversée par toute action).
        // La laisser hors mesure revenait à ne pas mesurer ce qui compte le plus.
        "src/lib/auth/guards.ts",
        "src/lib/security/upload-validation-service.ts",
        "src/lib/security/in-memory-rate-limiter.ts",
        // Compteur de limitation partagé (Vercel/serverless) : arithmétique de la
        // fenêtre et décision de l'adaptateur. La frontière SQL
        // (prisma-rate-limit-store.ts) reste hors mesure — elle ne contient pas de
        // décision, seulement l'instruction atomique, invérifiable sans base réelle.
        "src/lib/security/rate-limit-window.ts",
        "src/lib/security/postgres-rate-limiter.ts",
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
