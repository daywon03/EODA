import type { UserRole } from "@eoda/database";
import { pluralize, resolveActiveItem, type NavItem, type NavSection } from "./navigation";

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION DU PORTAIL CABINET (maquette « Portail Cabinet v2 »).
//
// Masquer une entrée n'est PAS un contrôle d'accès : la section Commercial est
// absente de la barre d'un CABINET_EVALUATOR, ET chaque page commerciale passe par
// requireCabinetAdminSession() (lib/auth/guards.ts) — vérifié par
// commercial-pages-guard.test.ts. Retirer la seconde parce que la première existe
// rouvrirait le module à quiconque tape l'adresse.
//
// N'apparaît que ce qui existe : pas d'« Équipe EODA » (tranche N9) tant que sa
// route n'existe pas — un lien vers une page absente est un bouton mort (D6).
// L'accueil est la racine du cabinet ; la liste des structures vit sous
// /structures, et la fiche reste sous /etablissements/[id].
// ─────────────────────────────────────────────────────────────────────────────

export const CABINET_ROOT = "/dashboard/cabinet";
export const REVIEW_QUEUE_PATH = `${CABINET_ROOT}/a-relire`;
export const STRUCTURES_PATH = `${CABINET_ROOT}/structures`;
const COMMERCIAL_ROOT = `${CABINET_ROOT}/commercial`;

export type CabinetNavCounts = {
  // Analyses non relues du tenant (lib/actions/review-queue.ts).
  documentsAwaitingReview: number;
  // Demandes d'option des clients en attente — admin seulement.
  pendingOptionRequests: number;
};

export function canSeeCommercial(role: UserRole): boolean {
  return role === "CABINET_ADMIN";
}

export function buildCabinetNav(role: UserRole, counts: CabinetNavCounts): NavSection[] {
  const main: NavItem[] = [
    { id: "home", href: CABINET_ROOT, label: "Accueil", icon: "home", exact: true },
    {
      id: "structures",
      href: STRUCTURES_PATH,
      label: "Structures",
      icon: "structures",
      alsoMatches: [`${CABINET_ROOT}/etablissements`],
    },
    {
      id: "review",
      href: REVIEW_QUEUE_PATH,
      label: "À relire",
      icon: "review",
      count: counts.documentsAwaitingReview,
      countLabel: pluralize(counts.documentsAwaitingReview, "document à relire", "documents à relire"),
    },
    { id: "agenda", href: `${CABINET_ROOT}/agenda`, label: "Agenda", icon: "agenda" },
    { id: "library", href: `${CABINET_ROOT}/modeles`, label: "Bibliothèque", icon: "library" },
    { id: "journal", href: `${CABINET_ROOT}/journal`, label: "Journal", icon: "journal" },
  ];

  const sections: NavSection[] = [{ id: "main", label: null, items: main }];
  if (!canSeeCommercial(role)) return sections;

  sections.push({
    id: "commercial",
    label: "Commercial",
    items: [
      {
        id: "commercial-overview",
        href: COMMERCIAL_ROOT,
        label: "Vue d'ensemble",
        icon: "commercial",
        exact: true,
        // La file des demandes d'option vit sur la vue d'ensemble : la pastille
        // remplace la cloche de l'ancienne barre (« pas assez visible », 07/09).
        count: counts.pendingOptionRequests,
        countLabel: pluralize(
          counts.pendingOptionRequests,
          "demande de prestation en attente",
          "demandes de prestation en attente"
        ),
      },
      { id: "prospects", href: `${COMMERCIAL_ROOT}/prospects`, label: "Prospects", icon: "prospects" },
      { id: "devis", href: `${COMMERCIAL_ROOT}/devis`, label: "Devis", icon: "devis" },
      { id: "catalogue", href: `${COMMERCIAL_ROOT}/catalogue`, label: "Catalogue", icon: "catalogue" },
    ],
  });
  return sections;
}

// ── Fil d'Ariane ──────────────────────────────────────────────────────────────

export type Crumb = { label: string; href: string | null };

// Segments statiques connus. `null` = segment sans page propre, sauté.
const SEGMENT_LABELS: Record<string, string | null> = {
  mission: "Mission",
  evaluation: "Auto-évaluation",
  comparaison: "Comparaison",
  chapitre: null,
  echanges: "Échanges",
  modifier: "Modifier",
  nouveau: "Nouveau",
  signature: "Signature",
  decouverte: "Grille de découverte",
  "evaluation-besoins": "Évaluation des besoins",
};

// Libellé d'un identifiant selon son parent : le nom réel (« SAD Les Glycines »)
// demanderait une lecture en base à chaque page pour un fil d'Ariane.
const DETAIL_LABELS: Record<string, string> = {
  etablissements: "Fiche structure",
  prospects: "Fiche prospect",
  devis: "Devis",
  modeles: "Modèle",
  chapitre: "Chapitre",
};

// Pages hors navigation du cabinet, partagées avec le client.
const SHARED_PAGES: Record<string, string> = {
  "/dashboard/profil": "Mon profil",
  "/dashboard/aide": "Aide",
};

function labelForSegment(segment: string, parent: string | undefined): string | null {
  if (segment in SEGMENT_LABELS) return SEGMENT_LABELS[segment] ?? null;
  const detail = parent ? DETAIL_LABELS[parent] : undefined;
  if (!detail) return null;
  // « Chapitre 2 » : le numéro EST le libellé ; un identifiant opaque ne l'est pas.
  return parent === "chapitre" ? `${detail} ${segment}` : detail;
}

function sharedPageCrumbs(pathname: string): Crumb[] {
  for (const [base, label] of Object.entries(SHARED_PAGES)) {
    if (pathname === base) return [{ label, href: null }];
    if (pathname.startsWith(`${base}/`)) return [{ label, href: base }, { label: "Article", href: null }];
  }
  return [];
}

export function buildCabinetBreadcrumb(sections: readonly NavSection[], pathname: string): Crumb[] {
  const active = resolveActiveItem(sections, pathname);
  if (!active) return sharedPageCrumbs(pathname);

  const crumbs: Crumb[] = [];
  const section = sections.find((s) => s.items.includes(active));
  if (section?.label) crumbs.push({ label: section.label, href: null });
  crumbs.push({ label: active.label, href: active.href });

  // Le reste de l'adresse sous le préfixe qui a désigné l'entrée active.
  const base = [active.href, ...(active.alsoMatches ?? [])]
    .filter((b) => pathname === b || pathname.startsWith(`${b}/`))
    .sort((a, b) => b.length - a.length)[0];
  const rest = (base ? pathname.slice(base.length) : "").split("/").filter(Boolean);
  const baseParent = base?.split("/").pop();

  let href = base ?? active.href;
  rest.forEach((segment, index) => {
    href = `${href}/${segment}`;
    const label = labelForSegment(segment, index === 0 ? baseParent : rest[index - 1]);
    if (label) crumbs.push({ label, href });
  });

  // La dernière miette est la page courante : jamais un lien vers elle-même.
  const last = crumbs[crumbs.length - 1];
  if (last) crumbs[crumbs.length - 1] = { ...last, href: null };
  return crumbs;
}
