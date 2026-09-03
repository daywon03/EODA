// ─────────────────────────────────────────────────────────────────────────────
// MANIFESTE DES MIGRATIONS
//
// Liste, dans l'ordre, les migrations que le code de cette version attend en base.
// Elle sert à une seule chose : détecter au démarrage qu'une base est à moitié
// déployée (schéma en retard sur le code) et le dire fort, plutôt que de laisser
// un utilisateur le découvrir par une erreur Prisma au milieu d'un dépôt de
// document.
//
// Pourquoi une constante plutôt qu'une lecture du dossier `prisma/migrations` à
// l'exécution : l'application déployée est un artefact Next.js « standalone » qui
// ne contient que les fichiers tracés par le bundler — le dossier de migrations
// n'en fait pas partie. Une lecture disque marcherait en développement et
// renverrait « aucune migration attendue » en production, c'est-à-dire exactement
// le contraire de ce qu'on veut.
//
// La duplication avec le dossier réel est tenue MÉCANIQUEMENT par le test
// `apps/web/src/lib/db/migration-manifest.test.ts`, qui compare cette liste au
// contenu de `prisma/migrations` et fait échouer la CI en cas d'écart (règle zéro
// des conventions d'ingénierie : une règle que rien ne vérifie n'est qu'un
// souhait). Ajouter une migration = ajouter sa ligne ici, sinon le test rougit.
// ─────────────────────────────────────────────────────────────────────────────

export const EXPECTED_MIGRATIONS: readonly string[] = [
  "20260706225218_init",
  "20260707102512_document_unique_per_type",
  "20260719152424_commercial_pipeline",
  "20260719160312_mission_tracking",
  "20260719174701_phase0_needs_and_justification",
  "20260719180201_has_referential_seed_keys",
  "20260819120000_audit_log",
  "20260819180000_catalogue_v10",
  "20260820090000_mission_checklist_min_formule",
  "20260820120000_password_rotation",
  "20260820150000_devis_cancellation",
  "20260820160000_user_deactivation_and_audit_actions",
  "20260820180000_client_option_request",
  "20260820210000_prospect_conversion",
  "20260821090000_establishment_delete_cascade",
  "20260821100000_rate_limit_counters",
  "20260822220000_mission_option_price_nature",
  "20260823010000_structure_type_and_mission_closure",
  "20260826090000_prospect_contact_and_timeline",
  "20260826140000_mission_client_access",
  "20260826170000_analysis_human_review",
  "20260827090000_appointments",
  "20260827120000_document_validation",
  "20260827140000_document_types_requested",
  "20260827160000_establishment_logo",
  "20260827180000_offer_labels_without_modules",
  "20260901090000_prospect_discovery",
  "20260901100000_evaluation_export_audit",
  "20260901110000_avenant_signature",
  "20260901120000_avenant_signature_audit",
  "20260901130000_document_reminder_audit",
  "20260901140000_mission_messages",
  "20260901150000_prospect_structure_identity",
  "20260902090000_structure_siret",
  "20260903090000_template_library",
] as const;
