// Seed de développement — données anonymisées + référentiel DocumentType
// Ne jamais committer de vraies données clients (client pilote, etc.)
import {
  PrismaClient,
  CommercialTier,
  MissionChecklistScope,
  PricingUnit,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedHasReferential } from "./seed-has-referential";
import { SEED_TENANT_ID } from "../src/seed-data";
import { DOCUMENT_TYPE_SEEDS } from "../src/document-types";
import { seedClientUserUpsertArgs, withRequestedFromClient } from "../src/seed-steps";

const prisma = new PrismaClient();

// bcrypt — doit rester cohérent avec la vérification dans apps/web/src/auth.ts
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Référentiel DocumentType — liste unique dans `src/document-types.ts` (données pures,
// testées) ; ce script l'upserte, il ne la redéclare pas.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue commercial — source de vérité : .claude/context/08-offre-commerciale-v10.md §04
// (plaquette du 18/08/2026, postérieure au call du 16/08 : elle prévaut sur les
// prix de context/07-outil-pilotage-missions.md §12.1).
// Tous les montants sont des prix « à partir de » HT (§12.3) — jamais fixes.
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
    modulesLabel: "Diagnostic des critères impératifs",
    description:
      "Diagnostic des 16 critères impératifs (1 journée) + analyse documentaire loi 2002-2 + rapport de diagnostic avec plan d'action à appliquer en autonomie — 2 à 4 semaines",
  },
  {
    formule: "PERFORMANCE",
    label: "Performance",
    priceEuros: 6500,
    modulesLabel: "Diagnostic complet · Analyse documentaire · Ateliers de validation",
    description:
      "Tout Essentiel + les 141 critères standards (2 jours) + analyse documentaire et mise en conformité (PLAC) + 3 journées d'atelier de validation documentaire — 3 mois",
  },
  {
    formule: "EXCELLENCE",
    label: "Excellence",
    priceEuros: 15000,
    modulesLabel:
      "Tout Performance · Suivi hebdomadaire · Création documentaire · Reporting · Ateliers · 2e auto-évaluation",
    description:
      "Tout Performance + réunions hebdomadaires de suivi du plan d'action + création documentaire (procédures, registres) + reporting Excel ou Power BI + 5 jours d'atelier en présentiel + nouvelle session d'auto-évaluation — 10 mois",
  },
];

// `pricingUnit` par défaut FORFAIT, `priceMaxEuros` pour une fourchette, `minQuantity`
// pour un minimum facturable exprimé dans l'unité (2 h, 12 mois d'engagement).
type OptionSeed = {
  code: string;
  label: string;
  priceEuros: number;
  pricingUnit?: PricingUnit;
  priceMaxEuros?: number;
  minQuantity?: number;
};

const CATALOGUE_OPTIONS: OptionSeed[] = [
  {
    code: "AUDIT_FLASH",
    label: "Audit de conformité flash (critères impératifs uniquement) — 1 jour",
    priceEuros: 800,
  },
  {
    code: "PROCEDURE_CLE_EN_MAIN",
    label: "Procédure clé en main (EI, plaintes, maltraitance, continuité…)",
    priceEuros: 250,
    pricingUnit: "DOCUMENT",
  },
  {
    code: "TABLEAU_BORD_KPI",
    label: "Tableau de bord Excel ou Power BI (24 KPI qualité)",
    priceEuros: 1200,
  },
  {
    code: "SIMULATION_VISITE",
    label: "Simulation de visite évaluateurs (entretiens + grille de préparation) — 2 jours",
    priceEuros: 1500,
  },
  {
    code: "PLAN_ACTIONS_ATC",
    label: "Accompagnement rédaction plan d'actions ATC",
    priceEuros: 500,
  },
  {
    code: "REVUE_ANNUELLE_PDCA",
    label: "Revue annuelle du plan d'actions PDCA — 0,5 jour",
    priceEuros: 750,
  },
  {
    code: "DIAGNOSTIC_RGPD",
    label: "Diagnostic RGPD & protection des données (SAD / ESSMS) — 1 jour",
    priceEuros: 1000,
  },
  {
    // Engagement d'un an minimum → minQuantity = 12 mois.
    code: "VEILLE_PORTAIL_EODA",
    label: "Veille réglementaire HAS + accès portail EODA (engagement 1 an minimum)",
    priceEuros: 400,
    pricingUnit: "MOIS",
    minQuantity: 12,
  },
  {
    code: "MAJ_DOCUMENTAIRE_HORAIRE",
    label: "Mise à jour documentaire à la carte",
    priceEuros: 95,
    pricingUnit: "HEURE",
    priceMaxEuros: 120,
    minQuantity: 2,
  },
  {
    code: "OUTILS_SENSIBILISATION",
    label: "Outils de sensibilisation (supports, documents de réunions, quiz)",
    priceEuros: 300,
    pricingUnit: "SUPPORT",
  },
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
  // Offre minimale qui couvre l'item — §12.4. Omis = ESSENTIEL (couvert par toutes
  // les formules). Doit rester aligné sur le backfill de la migration
  // 20260820090000_mission_checklist_min_formule, qui porte la justification
  // détaillée de chaque item hors Essentiel.
  minFormule?: CommercialTier;
};

const MISSION_CHECKLIST_ITEMS: MissionChecklistItemSeed[] = [
  // Diagnostic initial — 12 items
  { code: "DIAG_01", scope: "DIAGNOSTIC", order: 1, label: "Réunion de cadrage (validation besoins, planning)" },
  { code: "DIAG_02", scope: "DIAGNOSTIC", order: 2, label: "Recueil documentaire" },
  { code: "DIAG_03", scope: "DIAGNOSTIC", order: 3, label: "Validation du planning de visite", minFormule: "PERFORMANCE" },
  { code: "DIAG_04", scope: "DIAGNOSTIC", order: 4, label: "Réunion d'ouverture (revue du planning)", minFormule: "PERFORMANCE" },
  { code: "DIAG_05", scope: "DIAGNOSTIC", order: 5, label: "Visite du site (affichage, organisation)" },
  { code: "DIAG_06", scope: "DIAGNOSTIC", order: 6, label: "Entretiens méthode HAS — critères impératifs" },
  { code: "DIAG_07", scope: "DIAGNOSTIC", order: 7, label: "Réunion de bilan de visite (axes forts / écarts / axes de progrès)", minFormule: "PERFORMANCE" },
  // DIAG_08 reste ESSENTIEL : l'offre Essentiel EST la cotation des 16 impératifs.
  // C'est le périmètre de critères qui varie (offer-scope-service.criteriaScope),
  // pas la présence de l'item.
  { code: "DIAG_08", scope: "DIAGNOSTIC", order: 8, label: "Cotation des critères" },
  { code: "DIAG_09", scope: "DIAGNOSTIC", order: 9, label: "Vérification des documents loi 2002-2" },
  { code: "DIAG_10", scope: "DIAGNOSTIC", order: 10, label: "Rédaction du rapport diagnostic" },
  { code: "DIAG_11", scope: "DIAGNOSTIC", order: 11, label: "Co-construction du PLAC (plan d'amélioration continue)" },
  { code: "DIAG_12", scope: "DIAGNOSTIC", order: 12, label: "Réunion distancielle — restitution du PLAC" },

  // Phase 1 — Diagnostic, clé FONDATIONS (toutes formules) — libellés : PHASE_LABELS
  { code: "F1", scope: "FONDATIONS", order: 1, label: "PDCA co-construit" },
  { code: "F2", scope: "FONDATIONS", order: 2, label: "Pack documentaire P1-P5" },
  { code: "F3", scope: "FONDATIONS", order: 3, label: "Registres/tableaux de suivi" },

  // Phase 2 — Mise en conformité, clé DEPLOIEMENT (toutes formules)
  { code: "D1", scope: "DEPLOIEMENT", order: 1, label: "Ateliers de sensibilisation" },
  { code: "D2", scope: "DEPLOIEMENT", order: 2, label: "Formation gouvernance" },
  { code: "D3", scope: "DEPLOIEMENT", order: 3, label: "Mise en œuvre opérationnelle" },
  { code: "D4", scope: "DEPLOIEMENT", order: 4, label: "Traçabilité des actions" },

  // Phase 3 — Suivi, clé CONSOLIDATION (réservée Excellence / bêta-test gratuit)
  { code: "C1", scope: "CONSOLIDATION", order: 1, label: "Reporting KPI Power BI", minFormule: "EXCELLENCE" },
  { code: "C2", scope: "CONSOLIDATION", order: 2, label: "Revue mi-parcours", minFormule: "EXCELLENCE" },
  { code: "C3", scope: "CONSOLIDATION", order: 3, label: "Ajustement du plan d'actions", minFormule: "EXCELLENCE" },
  { code: "C4", scope: "CONSOLIDATION", order: 4, label: "Analyse EI/plaintes", minFormule: "EXCELLENCE" },

  // Phase 4 — Préparation finale (réservée Excellence / bêta-test gratuit)
  { code: "P1", scope: "PREPARATION_FINALE", order: 1, label: "Simulation de visite", minFormule: "EXCELLENCE" },
  { code: "P2", scope: "PREPARATION_FINALE", order: 2, label: "Entraînement aux 3 méthodes d'entretien", minFormule: "EXCELLENCE" },
  { code: "P3", scope: "PREPARATION_FINALE", order: 3, label: "Bilan final", minFormule: "EXCELLENCE" },
  { code: "P4", scope: "PREPARATION_FINALE", order: 4, label: "Rapport de recommandations", minFormule: "EXCELLENCE" },
];

async function main() {
  console.log("Seeding database…");

  // Tenant Cabinet EODA
  const tenant = await prisma.tenant.upsert({
    where: { id: SEED_TENANT_ID },
    update: {},
    create: { id: SEED_TENANT_ID, name: "EODA Conseil" },
  });

  // Utilisateurs de test (anonymes). `mustChangePassword: false` est explicite :
  // le défaut du schéma est `true` (fail-closed — tout compte réel doit tourner son
  // mot de passe à la première connexion), mais ces deux comptes sont des fixtures
  // de développement à identifiants publiquement connus, jamais remises à un client.
  const seedPasswordRotation = {
    mustChangePassword: false,
    passwordChangedAt: new Date(),
  };

  await prisma.user.upsert({
    where: { email: "cabinet@eoda-test.local" },
    update: { passwordHash: hashPassword("Test1234!"), ...seedPasswordRotation },
    create: {
      email: "cabinet@eoda-test.local",
      name: "Admin Cabinet (test)",
      passwordHash: hashPassword("Test1234!"),
      role: "CABINET_ADMIN",
      tenantId: tenant.id,
      ...seedPasswordRotation,
    },
  });

  // Compte client de test : déclaré dans le cabinet, sans structure (une fiche ne naît
  // que d'une signature) — rattachable depuis n'importe quelle fiche de ce cabinet.
  await prisma.user.upsert(seedClientUserUpsertArgs(hashPassword("Test1234!"), seedPasswordRotation));

  // Seed des 66 DocumentType — liste unique : src/document-types.ts (47 de
  // context/03-documents-obligatoires.md + 19 du référentiel documentaire du pilote).
  console.log(`Seeding ${DOCUMENT_TYPE_SEEDS.length} DocumentType…`);
  for (const dt of DOCUMENT_TYPE_SEEDS) {
    await prisma.documentType.upsert({
      where: { code: dt.code },
      update: {
        label: dt.label,
        category: dt.category,
        isConditional: dt.isConditional ?? false,
        expectedFrequency: dt.expectedFrequency ?? null,
      },
      // `requestedFromClient` à la création seulement : sur une base neuve, les
      // migrations qui le posent tournent AVANT le seed et ne touchent rien ; ensuite
      // il appartient à CABINET_ADMIN, un re-seed ne l'écrase pas.
      create: withRequestedFromClient({
        code: dt.code,
        category: dt.category,
        label: dt.label,
        isConditional: dt.isConditional ?? false,
        expectedFrequency: dt.expectedFrequency ?? null,
      }),
    });
  }

  // Seed du catalogue commercial — source de vérité : .claude/context/08-offre-commerciale-v10.md §04
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
      update: {
        label: o.label,
        priceEuros: o.priceEuros,
        pricingUnit: o.pricingUnit ?? "FORFAIT",
        priceMaxEuros: o.priceMaxEuros ?? null,
        minQuantity: o.minQuantity ?? null,
      },
      create: {
        tenantId: tenant.id,
        code: o.code,
        label: o.label,
        priceEuros: o.priceEuros,
        pricingUnit: o.pricingUnit ?? "FORFAIT",
        priceMaxEuros: o.priceMaxEuros ?? null,
        minQuantity: o.minQuantity ?? null,
      },
    });
  }

  // Retrait du catalogue des options des versions antérieures de la plaquette : elles
  // restent en base (des lignes de devis les référencent) mais ne sont plus proposées.
  // Sans cela, un re-seed laisse cohabiter l'ancien et le nouveau catalogue, et une
  // option retirée reste sélectionnable sur un devis client.
  const retired = await prisma.catalogueOption.updateMany({
    where: {
      tenantId: tenant.id,
      active: true,
      code: { notIn: CATALOGUE_OPTIONS.map((o) => o.code) },
    },
    data: { active: false },
  });
  if (retired.count > 0) {
    console.log(`  ${retired.count} option(s) hors plaquette v10 désactivée(s)`);
  }

  await prisma.billingSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    // Acompte 40 % à la commande — CGP v10 §06. `update: {}` volontaire : un taux
    // ajusté à la main dans Catalogue → Réglages de facturation n'est pas écrasé par
    // un re-seed. La migration 20260819180000_catalogue_v10 ne fait pas de backfill
    // non plus : un tenant déjà réglé à 30 % garde 30 % tant qu'il ne le change pas
    // lui-même dans l'UI.
    create: { tenantId: tenant.id, defaultDepositPercent: 40, defaultValidityDays: 30 },
  });

  console.log(`Seeding ${MISSION_CHECKLIST_ITEMS.length} MissionChecklistItem…`);
  for (const item of MISSION_CHECKLIST_ITEMS) {
    await prisma.missionChecklistItem.upsert({
      where: { code: item.code },
      update: {
        scope: item.scope,
        label: item.label,
        order: item.order,
        minFormule: item.minFormule ?? "ESSENTIEL",
      },
      create: {
        code: item.code,
        scope: item.scope,
        label: item.label,
        order: item.order,
        minFormule: item.minFormule ?? "ESSENTIEL",
      },
    });
  }

  console.log("Seeding référentiel HAS (Chapter/Theme/Objective/Criterion/EvaluationElement)…");
  await seedHasReferential(prisma);

  console.log("Seed completed ✓");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
