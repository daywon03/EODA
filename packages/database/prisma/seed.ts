// Seed de développement — données anonymisées + référentiel DocumentType
// Ne jamais committer de vraies données clients (ASSAD BENOIT, etc.)
import { PrismaClient, DocumentCategory, ExpectedFrequency } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "eoda_seed_salt").digest("hex");
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
    update: {},
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
    update: {},
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

  console.log("Seed completed ✓");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
