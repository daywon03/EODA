import { unstable_cache } from "next/cache";
import { prisma } from "@eoda/database";

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENTIEL HAS ET MATRICE — gardés en cache ENTRE les requêtes (21/10/2026).
//
// Mesuré ce jour-là : la vue d'ensemble d'une fiche relisait l'arbre complet des trois
// chapitres (thématiques, objectifs, critères, éléments d'évaluation) et le catalogue
// des critères à CHAQUE affichage — à ~55 ms l'aller-retour depuis un poste, des
// requêtes lourdes, pour des données qui ne changent qu'au chargement du référentiel.
//
// Deux familles, deux étiquettes :
//   - le RÉFÉRENTIEL (chapitres → éléments) ne change que par un seed ou une
//     migration : invalidé par l'expiration (une heure), et par HAS_REFERENTIAL_TAG
//     si un écran venait un jour à le modifier ;
//   - la MATRICE type de document ↔ critère change par l'écran d'administration :
//     chaque action qui l'écrit appelle `revalidateTag(CRITERION_MATRIX_TAG)`.
//
// Ce cache ne contient AUCUNE donnée de structure ni de cabinet : seulement le
// référentiel commun à tous. Le filtrage par offre et par profil SAD se fait en
// mémoire, par l'appelant, sur ces données.
// ─────────────────────────────────────────────────────────────────────────────

export const HAS_REFERENTIAL_TAG = "has-referential";
export const CRITERION_MATRIX_TAG = "criterion-matrix";
const ONE_HOUR = 3600;

export const readChapterTree = unstable_cache(
  async (chapterNumber: number) =>
    prisma.chapter.findFirst({
      where: { number: chapterNumber },
      include: {
        themes: {
          orderBy: { code: "asc" },
          include: {
            objectives: {
              orderBy: { code: "asc" },
              include: {
                criteria: { orderBy: { code: "asc" }, include: { evaluationElements: true } },
              },
            },
          },
        },
      },
    }),
  ["has-chapter-tree-v1"],
  { tags: [HAS_REFERENTIAL_TAG], revalidate: ONE_HOUR }
);

export const readChapters = unstable_cache(
  async () => prisma.chapter.findMany({ orderBy: { number: "asc" } }),
  ["has-chapters-v1"],
  { tags: [HAS_REFERENTIAL_TAG], revalidate: ONE_HOUR }
);

export const readCriteriaWithMatrix = unstable_cache(
  async () =>
    prisma.criterion.findMany({
      select: {
        id: true,
        code: true,
        label: true,
        requirementLevel: true,
        applicableTo: true,
        objective: { select: { theme: { select: { chapter: { select: { number: true } } } } } },
        documentTypes: { select: { documentTypeId: true } },
      },
    }),
  ["has-criteria-matrix-v1"],
  { tags: [HAS_REFERENTIAL_TAG, CRITERION_MATRIX_TAG], revalidate: ONE_HOUR }
);
