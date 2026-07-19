// Seed de développement — données anonymisées + référentiel DocumentType
// Ne jamais committer de vraies données clients (ASSAD BENOIT, etc.)
import {
  PrismaClient,
  DocumentCategory,
  ExpectedFrequency,
  CommercialTier,
  MissionChecklistScope,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// bcrypt — doit rester cohérent avec la vérification dans apps/web/src/auth.ts
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Référentiel DocumentType — source : context/03-documents-obligatoires.md
// Script unique et idempotent — ne pas dupliquer cette liste ailleurs
// ─────────────────────────────────────────────────────────────────────────────

type DocTypeSeed = {
  code: string;
  category: DocumentCategory;
  label: string;
  isConditional?: boolean;
  expectedFrequency?: ExpectedFrequency;
};

const DOCUMENT_TYPES: DocTypeSeed[] = [
  // ── Catégorie 1 — Loi 2002-2 (obligatoires, tous ESSMS) ──────────────────
  {
    code: "L2002_PROJET_SERVICE",
    category: "LOI_2002_2",
    label: "Projet d'établissement / Projet de service",
  },
  {
    code: "L2002_CHARTE_DROITS",
    category: "LOI_2002_2",
    label: "Charte des droits et libertés de la personne accueillie",
  },
  {
    code: "L2002_LIVRET_ACCUEIL",
    category: "LOI_2002_2",
    label: "Livret d'accueil",
  },
  {
    code: "L2002_CR_CVS",
    category: "LOI_2002_2",
    label: "Comptes-rendus CVS (ou autre forme de participation des usagers)",
    expectedFrequency: "ANNUAL",
  },
  {
    code: "L2002_DIPC",
    category: "LOI_2002_2",
    label: "DIPC / Contrat de séjour",
    expectedFrequency: "ANNUAL",
  },
  {
    code: "L2002_REGLEMENT_FONCTIONNEMENT",
    category: "LOI_2002_2",
    label: "Règlement de fonctionnement",
  },
  {
    code: "L2002_PERSONNES_QUALIFIEES",
    category: "LOI_2002_2",
    label: "Liste des personnes qualifiées (préfet / président Conseil Départemental)",
  },

  // ── Catégorie 2 — Fonctionnement de la structure ─────────────────────────
  {
    code: "FONCT_ORGANIGRAMME",
    category: "FONCTIONNEMENT",
    label: "Organigramme",
  },
  {
    code: "FONCT_PLAQUETTE",
    category: "FONCTIONNEMENT",
    label: "Plaquette / supports d'information sur l'offre de service",
  },
  {
    code: "FONCT_RAPPORTS_ACTIVITE",
    category: "FONCTIONNEMENT",
    label: "3 derniers rapports d'activité annuels",
    expectedFrequency: "ANNUAL",
  },
  {
    code: "FONCT_CPOM",
    category: "FONCTIONNEMENT",
    label: "CPOM (si concerné)",
    isConditional: true,
  },
  {
    code: "FONCT_CR_COMMISSIONS",
    category: "FONCTIONNEMENT",
    label: "3 derniers comptes-rendus de commissions (animation, restauration…)",
  },
  {
    code: "FONCT_PLANNING_ANIMATION",
    category: "FONCTIONNEMENT",
    label: "Planning d'animation des 3 derniers mois (si concerné)",
    isConditional: true,
  },
  {
    code: "FONCT_LISTE_PARTENAIRES",
    category: "FONCTIONNEMENT",
    label: "Liste des partenaires mobilisables",
  },
  {
    code: "FONCT_DIRECTIVES_ANTICIPEES",
    category: "FONCTIONNEMENT",
    label: "Support d'information sur les directives anticipées (si concerné)",
    isConditional: true,
  },

  // ── Catégorie 3 — Démarche qualité et gestion des risques ────────────────
  {
    code: "QUALITE_AUTOEVAL_ANTERIEURE",
    category: "QUALITE_RISQUES",
    label: "Rapport d'évaluation interne / auto-évaluation antérieure",
  },
  {
    code: "QUALITE_ENQUETES_SATISFACTION",
    category: "QUALITE_RISQUES",
    label: "Synthèse des 3 dernières enquêtes de satisfaction",
  },
  {
    code: "QUALITE_PCA_PLAN_BLEU",
    category: "QUALITE_RISQUES",
    label: "Plan bleu / PCA (continuité d'activité)",
  },
  {
    code: "QUALITE_POLITIQUE_INDEX",
    category: "QUALITE_RISQUES",
    label: "Politique qualité + index référentiel des procédures",
  },
  {
    code: "QUALITE_PROCEDURE_EI_PLAINTES",
    category: "QUALITE_RISQUES",
    label: "Procédure traitement EI / réclamations / signalements maltraitance",
  },

  // Objectif 3.12 — Plaintes & réclamations (critère impératif)
  {
    code: "P12_REGISTRE",
    category: "QUALITE_RISQUES",
    label: "Registre des plaintes / réclamations (Obj. 3.12)",
  },
  {
    code: "P12_AR_TYPE",
    category: "QUALITE_RISQUES",
    label: "Accusés de réception type — plaintes (Obj. 3.12)",
  },
  {
    code: "P12_REPONSE_FINALE",
    category: "QUALITE_RISQUES",
    label: "Modèle de réponse finale — plaintes (Obj. 3.12)",
  },
  {
    code: "P12_CR_ANALYSE_EQUIPE",
    category: "QUALITE_RISQUES",
    label: "CR de réunion d'analyse en équipe — plaintes (Obj. 3.12)",
  },
  {
    code: "P12_BILAN_ANNUEL",
    category: "QUALITE_RISQUES",
    label: "Bilan annuel d'activité qualité — volet plaintes (Obj. 3.12)",
    expectedFrequency: "ANNUAL",
  },

  // Objectif 3.13 — EI / EIG (critère impératif)
  {
    code: "P13_FICHE_DECLARATION",
    category: "QUALITE_RISQUES",
    label: "Fiche de déclaration EI type (Obj. 3.13)",
  },
  {
    code: "P13_TABLEAU_SUIVI",
    category: "QUALITE_RISQUES",
    label: "Tableau de suivi des EI / EIG (Obj. 3.13)",
  },
  {
    code: "P13_CR_RETEX",
    category: "QUALITE_RISQUES",
    label: "CR de RETEX / CREX (Obj. 3.13)",
  },
  {
    code: "P13_SIGNALEMENT_ARS",
    category: "QUALITE_RISQUES",
    label: "Preuve de signalement ARS si EIG (Obj. 3.13)",
    isConditional: true,
  },

  // Objectif 3.11 — Maltraitance (critère impératif)
  {
    code: "P11_CARTOGRAPHIE_RISQUES",
    category: "QUALITE_RISQUES",
    label: "Cartographie des risques de maltraitance (Obj. 3.11)",
  },
  {
    code: "P11_PLAN_PREVENTION",
    category: "QUALITE_RISQUES",
    label: "Plan de prévention maltraitance (Obj. 3.11)",
  },
  {
    code: "P11_CR_SENSIBILISATION",
    category: "QUALITE_RISQUES",
    label: "CR de sensibilisation des équipes — maltraitance (Obj. 3.11)",
  },
  {
    code: "P11_SIGNALEMENTS_TRACES",
    category: "QUALITE_RISQUES",
    label: "Traçabilité des signalements traités (Obj. 3.11)",
  },

  // Objectif 3.14 — Continuité / gestion de crise (critère impératif)
  {
    code: "P14_PGC_REDIGE",
    category: "QUALITE_RISQUES",
    label: "Plan de gestion de crise (PGC) rédigé (Obj. 3.14)",
  },
  {
    code: "P14_PCA_REDIGE",
    category: "QUALITE_RISQUES",
    label: "PCA rédigé (Obj. 3.14)",
  },
  {
    code: "P14_CR_DIFFUSION",
    category: "QUALITE_RISQUES",
    label: "CR de diffusion interne / externe — PCA/PGC (Obj. 3.14)",
  },
  {
    code: "P14_PREUVE_SIMULATION",
    category: "QUALITE_RISQUES",
    label: "Preuve de simulation / exercice — PCA/PGC (Obj. 3.14)",
  },
  {
    code: "P14_DATE_REVISION",
    category: "QUALITE_RISQUES",
    label: "Date de dernière révision du PCA/PGC (Obj. 3.14)",
  },

  // Objectif 2.2 — Droits & confidentialité (critère impératif)
  {
    code: "P22_FORMULAIRES_CONSENTEMENT",
    category: "QUALITE_RISQUES",
    label: "Formulaires de consentement — droit à l'image, etc. (Obj. 2.2)",
  },
  {
    code: "P22_DUI_SECURISE",
    category: "QUALITE_RISQUES",
    label: "Preuve de sécurisation du DUI (Obj. 2.2)",
  },
  {
    code: "P22_FORMATION_RGPD",
    category: "QUALITE_RISQUES",
    label: "Preuve de formation / sensibilisation RGPD (Obj. 2.2)",
  },
  {
    code: "P22_REGISTRE_TRAITEMENTS",
    category: "QUALITE_RISQUES",
    label: "Registre des traitements de données (Obj. 2.2)",
  },
  {
    code: "P22_CHARTE_INFORMATIQUE",
    category: "QUALITE_RISQUES",
    label: "Charte informatique (Obj. 2.2)",
  },
  {
    code: "P22_EMARGEMENT_SENSIBILISATION",
    category: "QUALITE_RISQUES",
    label: "Feuilles d'émargement sensibilisation droits (Obj. 2.2)",
  },

  // ── Catégorie 4 — Ressources humaines ────────────────────────────────────
  {
    code: "RH_LIVRET_SALARIE",
    category: "RH",
    label: "Livret d'accueil du salarié",
  },
  {
    code: "RH_PLAN_FORMATION",
    category: "RH",
    label: "Plan de formation / programme de sensibilisation",
  },
  {
    // ⚠ Obligation Code du Travail — PAS une exigence HAS. Libellé volontairement distinct.
    code: "RH_DUERP",
    category: "RH",
    label: "DUERP — Document Unique d'Évaluation des Risques Professionnels (exigence Code du Travail, hors périmètre HAS)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue commercial — source : context/07-outil-pilotage-missions.md §4
// Script unique et idempotent — ne pas dupliquer cette liste ailleurs
// ─────────────────────────────────────────────────────────────────────────────

type FormuleSeed = {
  formule: CommercialTier;
  label: string;
  priceEuros: number;
  modulesLabel: string;
  description: string;
};

const CATALOGUE_FORMULES: FormuleSeed[] = [
  {
    formule: "ESSENTIEL",
    label: "Essentiel",
    priceEuros: 2500,
    modulesLabel: "M1 · M2",
    description: "Diagnostic & cadrage + plan d'action",
  },
  {
    formule: "PERFORMANCE",
    label: "Performance",
    priceEuros: 6500,
    modulesLabel: "M1 · M2 · M3 · M4",
    description: "Diagnostic, plan d'action, déploiement des outils et accompagnement terrain",
  },
  {
    formule: "EXCELLENCE",
    label: "Excellence",
    priceEuros: 12000,
    modulesLabel: "M1 à M5",
    description: "Accompagnement complet jusqu'au pilotage par KPI",
  },
];

type OptionSeed = { code: string; label: string; priceEuros: number };

const CATALOGUE_OPTIONS: OptionSeed[] = [
  { code: "JOURNEE_SUPP_VISITE", label: "Journée supplémentaire de visite sur site", priceEuros: 800 },
  { code: "FORMATION_EQUIPE", label: "Formation équipe (½ journée)", priceEuros: 600 },
  { code: "REGISTRE_EI_EIG", label: "Registre plaintes/réclamations EI-EIG personnalisé", priceEuros: 450 },
  { code: "REUNION_PAC_SUPP", label: "Réunion de restitution PAC supplémentaire", priceEuros: 350 },
  { code: "TABLEAU_KPI_POWERBI", label: "Tableau de bord KPI Power BI sur mesure", priceEuros: 900 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Référentiel de suivi de mission — source : context/07-outil-pilotage-missions.md §7.1-§7.2
// Script unique et idempotent — ne pas dupliquer cette liste ailleurs
// ─────────────────────────────────────────────────────────────────────────────

type MissionChecklistItemSeed = {
  code: string;
  scope: MissionChecklistScope;
  label: string;
  order: number;
};

const MISSION_CHECKLIST_ITEMS: MissionChecklistItemSeed[] = [
  // Diagnostic initial — 12 items
  { code: "DIAG_01", scope: "DIAGNOSTIC", order: 1, label: "Réunion de cadrage (validation besoins, planning)" },
  { code: "DIAG_02", scope: "DIAGNOSTIC", order: 2, label: "Recueil documentaire" },
  { code: "DIAG_03", scope: "DIAGNOSTIC", order: 3, label: "Validation du planning de visite" },
  { code: "DIAG_04", scope: "DIAGNOSTIC", order: 4, label: "Réunion d'ouverture (revue du planning)" },
  { code: "DIAG_05", scope: "DIAGNOSTIC", order: 5, label: "Visite du site (affichage, organisation)" },
  { code: "DIAG_06", scope: "DIAGNOSTIC", order: 6, label: "Entretiens méthode HAS — critères impératifs" },
  { code: "DIAG_07", scope: "DIAGNOSTIC", order: 7, label: "Réunion de bilan de visite (axes forts / écarts / axes de progrès)" },
  { code: "DIAG_08", scope: "DIAGNOSTIC", order: 8, label: "Cotation des critères" },
  { code: "DIAG_09", scope: "DIAGNOSTIC", order: 9, label: "Vérification des documents loi 2002-2" },
  { code: "DIAG_10", scope: "DIAGNOSTIC", order: 10, label: "Rédaction du rapport diagnostic" },
  { code: "DIAG_11", scope: "DIAGNOSTIC", order: 11, label: "Création du PAC (plan d'action)" },
  { code: "DIAG_12", scope: "DIAGNOSTIC", order: 12, label: "Réunion distancielle — restitution du PAC" },

  // Phase 1 — Fondations (toutes formules)
  { code: "F1", scope: "FONDATIONS", order: 1, label: "PDCA co-construit" },
  { code: "F2", scope: "FONDATIONS", order: 2, label: "Pack documentaire P1-P5" },
  { code: "F3", scope: "FONDATIONS", order: 3, label: "Registres/tableaux de suivi" },

  // Phase 2 — Déploiement (toutes formules)
  { code: "D1", scope: "DEPLOIEMENT", order: 1, label: "Ateliers de sensibilisation" },
  { code: "D2", scope: "DEPLOIEMENT", order: 2, label: "Formation gouvernance" },
  { code: "D3", scope: "DEPLOIEMENT", order: 3, label: "Mise en œuvre opérationnelle" },
  { code: "D4", scope: "DEPLOIEMENT", order: 4, label: "Traçabilité des actions" },

  // Phase 3 — Consolidation (réservée Excellence / bêta-test gratuit)
  { code: "C1", scope: "CONSOLIDATION", order: 1, label: "Reporting KPI Power BI" },
  { code: "C2", scope: "CONSOLIDATION", order: 2, label: "Revue mi-parcours" },
  { code: "C3", scope: "CONSOLIDATION", order: 3, label: "Ajustement du plan d'actions" },
  { code: "C4", scope: "CONSOLIDATION", order: 4, label: "Analyse EI/plaintes" },

  // Phase 4 — Préparation finale (réservée Excellence / bêta-test gratuit)
  { code: "P1", scope: "PREPARATION_FINALE", order: 1, label: "Simulation de visite" },
  { code: "P2", scope: "PREPARATION_FINALE", order: 2, label: "Entraînement aux 3 méthodes d'entretien" },
  { code: "P3", scope: "PREPARATION_FINALE", order: 3, label: "Bilan final" },
  { code: "P4", scope: "PREPARATION_FINALE", order: 4, label: "Rapport de recommandations" },
];

async function main() {
  console.log("Seeding database…");

  // Tenant Cabinet EODA
  const tenant = await prisma.tenant.upsert({
    where: { id: "tenant-eoda-conseil" },
    update: {},
    create: { id: "tenant-eoda-conseil", name: "EODA Conseil" },
  });

  // Utilisateurs de test (anonymes)
  await prisma.user.upsert({
    where: { email: "cabinet@eoda-test.local" },
    update: { passwordHash: hashPassword("Test1234!") },
    create: {
      email: "cabinet@eoda-test.local",
      name: "Admin Cabinet (test)",
      passwordHash: hashPassword("Test1234!"),
      role: "CABINET_ADMIN",
      tenantId: tenant.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "client@eoda-test.local" },
    update: { passwordHash: hashPassword("Test1234!") },
    create: {
      email: "client@eoda-test.local",
      name: "Utilisateur Client (test)",
      passwordHash: hashPassword("Test1234!"),
      role: "CLIENT_USER",
    },
  });

  // Seed des 47 DocumentType — source de vérité : context/03-documents-obligatoires.md
  console.log(`Seeding ${DOCUMENT_TYPES.length} DocumentType…`);
  for (const dt of DOCUMENT_TYPES) {
    await prisma.documentType.upsert({
      where: { code: dt.code },
      update: {
        label: dt.label,
        category: dt.category,
        isConditional: dt.isConditional ?? false,
        expectedFrequency: dt.expectedFrequency ?? null,
      },
      create: {
        code: dt.code,
        category: dt.category,
        label: dt.label,
        isConditional: dt.isConditional ?? false,
        expectedFrequency: dt.expectedFrequency ?? null,
      },
    });
  }

  // Seed du catalogue commercial — source de vérité : context/07-outil-pilotage-missions.md §4
  console.log(`Seeding ${CATALOGUE_FORMULES.length} CatalogueFormule…`);
  for (const f of CATALOGUE_FORMULES) {
    await prisma.catalogueFormule.upsert({
      where: { tenantId_formule: { tenantId: tenant.id, formule: f.formule } },
      update: {
        label: f.label,
        priceEuros: f.priceEuros,
        modulesLabel: f.modulesLabel,
        description: f.description,
      },
      create: {
        tenantId: tenant.id,
        formule: f.formule,
        label: f.label,
        priceEuros: f.priceEuros,
        modulesLabel: f.modulesLabel,
        description: f.description,
      },
    });
  }

  console.log(`Seeding ${CATALOGUE_OPTIONS.length} CatalogueOption…`);
  for (const o of CATALOGUE_OPTIONS) {
    await prisma.catalogueOption.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: o.code } },
      update: { label: o.label, priceEuros: o.priceEuros },
      create: { tenantId: tenant.id, code: o.code, label: o.label, priceEuros: o.priceEuros },
    });
  }

  await prisma.billingSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, defaultDepositPercent: 30, defaultValidityDays: 30 },
  });

  console.log(`Seeding ${MISSION_CHECKLIST_ITEMS.length} MissionChecklistItem…`);
  for (const item of MISSION_CHECKLIST_ITEMS) {
    await prisma.missionChecklistItem.upsert({
      where: { code: item.code },
      update: { scope: item.scope, label: item.label, order: item.order },
      create: { code: item.code, scope: item.scope, label: item.label, order: item.order },
    });
  }

  console.log("Seed completed ✓");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
