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
  // tsconfig.json garde `jsx: "preserve"` (Next compile lui-même) ; les tests de
  // rendu des primitives (components/ui/primitives.test.ts) ont besoin que Vite
  // transforme le JSX.
  oxc: {
    jsx: { runtime: "automatic" },
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
        // Validation des suggestions de critères HAS détectées par l'IA (persona
        // « adjoint IA qualité HAS », 20/09/2026) : un code accepté à tort est un
        // rattachement HAS inventé qui atteint la revue humaine sous une fausse
        // apparence de véracité.
        "src/lib/services/criterion-suggestion-service.ts",
        // Lecture du JSON d'analyse : c'est une entrée non fiable (colonne Json
        // écrite par un modèle, sous un contrat qui a pu changer). Un parseur trop
        // permissif afficherait une analyse vide comme un document sans reproche.
        "src/lib/services/analysis-view-service.ts",
        // Parcours documentaire et droits de suppression : une erreur ici efface la
        // pièce d'un client, ou laisse croire qu'un document est validé.
        "src/lib/services/document-workflow-service.ts",
        // Fin de mission : ce service décide qui peut encore lire et déposer. Une
        // erreur ici ferme l'accès d'un client à ses propres documents, ou le laisse
        // ouvert après une révocation.
        "src/lib/services/mission-access-service.ts",
        // Avenant et convention de nommage : deux règles qui sortent un document
        // CONTRACTUEL de la plateforme. Un mauvais tri de lignes fait signer deux
        // fois la même prestation, un mauvais nom de fichier part chez le client.
        "src/lib/services/avenant-service.ts",
        "src/lib/services/document-naming-service.ts",
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
        // Agenda : grille de mois, sélection des prochains rendez-vous, détection de
        // chevauchement. Une erreur ici déplace un rendez-vous à l'écran sans que rien
        // n'échoue — et quelqu'un se déplace pour rien.
        "src/lib/services/calendar-service.ts",
        // Format de date unique (JJ/MM/AAAA) : le test tient la règle demandée.
        "src/lib/services/date-format-service.ts",
        // Modèles d'e-mail : ils sortent de la plateforme vers des gens, et
        // interpolent des saisies dans du HTML.
        "src/lib/email/templates.ts",
        "src/lib/email/commercial-templates.ts",
        // Devis par abonnement (maquettes v2, 13/10) : « Par mois » / « Ponctuel »,
        // engagement, relance due. Un défaut ici affiche un montant inventé à la place
        // de « xx € », ou propose de relancer un devis signé.
        "src/lib/services/devis-recap-service.ts",
        "src/lib/services/devis-catalogue-choices.ts",
        "src/lib/services/devis-list-service.ts",
        "src/lib/services/catalogue-view-service.ts",
        // Libre-service (D5) : validation d'une inscription publique, avancement et
        // liste de travail dérivés, signal d'activité, tableau Prospects. Un défaut ici
        // ouvre une inscription mal formée, ou relance une structure qui avance.
        "src/lib/services/self-service-service.ts",
        "src/lib/services/prospect-diagnostic-service.ts",
        "src/lib/services/prospect-pipeline-service.ts",
        "src/lib/services/commercial-overview-service.ts",
        // Confirmation d'adresse du libre-service (tranche 11) : qui doit confirmer,
        // quand un lien part, et que le lien ne s'affiche JAMAIS en production. Le
        // jeton à usage unique est le socle partagé avec le quiz par QR code.
        "src/lib/services/email-verification-service.ts",
        "src/lib/security/one-time-token.ts",
        // Mentions de paternité : un texte juridique apposé sur des documents remis
        // au client. Le test verrouille la formulation dictée en séance, et empêche
        // qu'une revendication de propriété atterrisse sur un devis.
        "src/lib/services/document-ownership-service.ts",
        // Rapport de mise en conformité : c'est lui qui décide ce qui part chez le
        // client. Une analyse non relue qui s'y glisserait contournerait la revue
        // humaine par la porte de l'imprimante.
        "src/lib/services/conformity-report-service.ts",
        // File « À relire » : elle décide quelles analyses attendent la revue
        // humaine. Une version oubliée ici reste invisible au client sans que
        // personne ne sache qu'elle attend.
        "src/lib/services/review-queue-service.ts",
        // Fiche structure v2 : onglets-compteurs des documents, action principale,
        // prochaines actions, frise de mission. Tout y est DÉRIVÉ — une erreur ne
        // fait rien échouer, elle affiche un compteur ou un appel à l'action faux.
        "src/lib/services/structure-documents-service.ts",
        "src/lib/services/structure-sheet-service.ts",
        "src/lib/services/structures-overview-service.ts",
        // Critères & preuves (N4) : la matrice proposée ne doit écrire que ce que
        // l'admin a coché parmi les propositions ; « prouvé » ne doit jamais
        // s'afficher sans relecture EODA ou acceptation de la structure ; un SAD aide
        // ne doit jamais voir un critère de soins.
        "src/lib/services/criterion-matrix-service.ts",
        "src/lib/services/criteria-proof-service.ts",
        "src/lib/services/criterion-applicability-service.ts",
        // Choix des critères d'un gabarit (call du 20/09) : le rangement par chapitre
        // et thématique n'échoue jamais, il rend seulement un critère introuvable —
        // donc jamais rattaché au document qui devait le prouver.
        "src/lib/services/criterion-picker-service.ts",
        // « Un compte existe déjà » : un défaut ici révèle un compte d'un autre cabinet.
        "src/lib/services/existing-account-service.ts",
        // Tâches = PAC (N5) : « en retard » dérivé, droits client / cabinet, et
        // propositions d'action (jamais d'action sur un critère coté 4).
        "src/lib/services/action-item-service.ts",
        "src/lib/services/pac-proposal-service.ts",
        // Mon diagnostic (N6) : ce que la structure lit de ses impératifs, et les deux
        // gestes. Un défaut ici annonce « relu par EODA » sur un état jamais relu, ou
        // laisse la structure accepter ce qu'EODA n'a pas encore vu.
        "src/lib/services/diagnostic-service.ts",
        "src/lib/services/diagnostic-validation-service.ts",
        // Pratiques (N7) : une réponse invalide acceptée, ou une réponse à une ancienne
        // formulation comptée comme à jour, fausse ce que la structure dit d'elle-même.
        "src/lib/services/practice-service.ts",
        // Mise en conformité côte à côte (N8) : la sortie du modèle est une entrée non
        // fiable (schéma, purge des codes et citations non prouvés) ; un ajout refusé qui
        // entrerait dans la version N+1, ou un export sans sa mention, part chez le client.
        "src/lib/llm/correction-proposal.ts",
        "src/lib/services/correction-proposal-service.ts",
        "src/lib/services/annotated-docx-service.ts",
        "src/lib/services/validated-example-service.ts",
        // Péremption documentaire : elle décide qu'un document « conforme » ne l'est
        // plus. Dérivée de l'horloge, donc jamais vérifiable par un statut en base.
        "src/lib/services/document-expiry-service.ts",
        "src/lib/services/prospect-contact-service.ts",
        "src/lib/services/prospect-next-action-service.ts",
        "src/lib/services/devis-sharing-service.ts",
        // Ce que l'écran dit d'un envoi et d'un PDF raté : un « envoyé » pour un e-mail
        // jamais parti, ou un « réessayez » qui ne peut pas aboutir (test du 12/10).
        "src/lib/services/email-delivery-service.ts",
        "src/lib/services/devis-pdf-failure.ts",
        // Correctifs du test de bout en bout (12/10) : chacun décide d'un texte que
        // la structure ou le cabinet lit — un défaut ici ne fait rien échouer, il
        // affiche « en cours » à la place d'« indisponible », ou une mauvaise formule.
        "src/lib/services/login-notice-service.ts",
        "src/lib/services/client-document-waiting-service.ts",
        "src/lib/services/devis-initial-formule-service.ts",
        "src/lib/services/chapter-label-service.ts",
        "src/lib/services/discovery-grid-service.ts",
        "src/lib/config/production-profile.ts",
        "src/lib/db/migration-status.ts",
        // CSP à nonce : le test EST le garde-fou qui empêche `'unsafe-inline'` de
        // revenir sur script-src, et `'unsafe-eval'` d'atteindre la production.
        "src/lib/security/content-security-policy.ts",
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
        // Système de design (maquettes v2) : contraste WCAG des tokens, garde-fous
        // de taille de texte et de focus, vocabulaire des pastilles de statut, et
        // logique clavier des primitives. Un défaut ici ne fait échouer aucun test
        // métier : il rend un écran illisible ou inutilisable au clavier.
        "src/lib/design/**/*.ts",
        // Lot C (terrain, 14/10/2026) : le verrou HDS et les services purs de
        // l'enquête et de la signature. Un défaut ici écrit une donnée de santé sur
        // une infrastructure non certifiée, affiche un taux de satisfaction faux dans
        // un dossier d'évaluation, ou accepte une signature sans son dossier de preuve.
        "src/lib/hds/index.ts",
        "src/lib/hds/locked-beneficiary-data-adapter.ts",
        "src/lib/services/survey-stats-service.ts",
        "src/lib/services/survey-report-service.ts",
        "src/lib/services/signature-evidence-service.ts",
        "src/lib/services/reception-sheet-service.ts",
        "src/lib/services/beneficiary-deadline-service.ts",
        "src/lib/security/tablet-pin.ts",
        "src/lib/security/tablet-session.ts",
        "src/lib/services/survey-answer-parser.ts",
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
