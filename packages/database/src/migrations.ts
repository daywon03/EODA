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
  "20260903120000_foreign_key_indexes",
  "20260904090000_template_library_categories",
  "20260904090100_template_library_audit",
  "20260906220000_knowledge_chunks",
  "20260910130000_document_type_corrections",
  "20260910130100_document_type_correction_audit",
  "20260910140000_criterion_guideline_audit",
  "20260910140100_criterion_guidelines",
  "20260910150000_template_version_extracted_text",
  "20260915170000_document_reanalyzed_audit",
  "20260915180000_corrected_draft",
  "20260915190000_corrected_draft_audit",
  "20260916090000_establishment_user_role_responsable_qualite",
  "20260916120000_template_document_criteria",
  "20260916130000_document_version_images",
  "20260920160000_document_criterion_suggestions",
  "20260920200000_template_criterion_suggestions",
  "20260920210000_drop_template_stage_initiale",
  "20260922120000_devis_email_sent_audit_action",
  "20260927100000_establishment_user_deliverables_seen_at",
  "20261010090000_element_rating_rated_by",
  "20261010120000_support_mode_client_acceptance",
  "20261011090000_devis_without_offer_client_user_link",
  "20261011100000_drop_seed_header_criterion",
  "20261011110000_sad_mixte_criteria",
  "20261011120000_criterion_matrix_audit",
  "20261011130000_action_items",
  "20261012090000_diagnostic_validation",
  "20261012100000_practice_answers",
  "20261012110000_compliance_proposals",
  "20261013090000_cabinet_roles_assignments",
  "20261013100000_client_access_roles",
  "20261013110000_staff_quiz",
  "20261013120000_devis_subscription",
  "20261013130000_catalogue_option_audience",
  "20261013140000_self_service_prospects",
  "20261013150000_email_verification",
  "20261014090000_lot_c_terrain",
  "20261014100000_lot_c_audit_actions",
  "20261014110000_sad_mixte_full_labels",
  "20261014120000_pilot_document_types",
  "20261021090000_blank_model_personalized_labels",
  "20261021100000_criterion_guideline_ai_enabled",
  "20261021110000_anonymous_survey",
] as const;
