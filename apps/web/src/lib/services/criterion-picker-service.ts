// ─────────────────────────────────────────────────────────────────────────────
// RANGEMENT DES CRITÈRES HAS POUR UN SÉLECTEUR.
//
// « Les 157 critères… j'ai mal à la tête » (Sandrine, call du 20/09/2026) : une
// liste plate de 157 lignes ne se parcourt pas. Elle demande « par chapitre et
// thématique, impératifs d'abord », puis, le même jour : « tu ne mets que les
// impératifs dans EODA dans ta partie ».
//
// Ce module ne fait que trier et regrouper — il ne lit ni la base ni la session,
// donc il se teste sans serveur. L'ordre est DÉRIVÉ du référentiel (chapitre,
// puis thématique, puis code), jamais d'une liste recopiée : le jour où le manuel
// HAS bouge, le rangement suit.
//
// « Impératifs d'abord » est appliqué À L'INTÉRIEUR de chaque thématique, pas en
// tête de liste : un critère sorti de son chapitre perdrait le contexte qui rend
// la sélection compréhensible. Le filtre global (`imperativesOnly`) répond au
// second besoin — ne voir QUE les impératifs.
// ─────────────────────────────────────────────────────────────────────────────

export type PickerCriterion = {
  id: string;
  code: string;
  label: string;
  requirementLevel: "IMPERATIF" | "STANDARD";
  chapterNumber: number;
  chapterName: string;
  themeCode: string;
  themeName: string;
};

export type PickerThemeGroup = {
  code: string;
  name: string;
  criteria: PickerCriterion[];
};

export type PickerChapterGroup = {
  number: number;
  name: string;
  themes: PickerThemeGroup[];
  criteriaCount: number;
  imperativesCount: number;
};

export type PickerOptions = {
  /** Ne garder que les critères impératifs — et retirer les groupes devenus vides. */
  imperativesOnly?: boolean;
  /** Filtre libre sur le code ou l'intitulé (insensible à la casse). */
  query?: string;
};

/**
 * Compare deux codes HAS segment par segment (« 1.7.10 » se range après
 * « 1.7.9 », ce qu'un `localeCompare` ne garantit pas selon l'environnement).
 */
export function compareCriterionCodes(a: string, b: string): number {
  const left = a.split(".");
  const right = b.split(".");
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index++) {
    const aSegment = left[index];
    const bSegment = right[index];
    if (aSegment === undefined) return -1;
    if (bSegment === undefined) return 1;

    const aNumber = Number(aSegment);
    const bNumber = Number(bSegment);
    const bothNumeric = Number.isFinite(aNumber) && Number.isFinite(bNumber);

    if (bothNumeric) {
      if (aNumber !== bNumber) return aNumber - bNumber;
      continue;
    }
    if (aSegment !== bSegment) return aSegment < bSegment ? -1 : 1;
  }
  return 0;
}

function matchesQuery(criterion: PickerCriterion, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = `${criterion.code} ${criterion.label}`.toLocaleLowerCase("fr");
  return haystack.includes(query);
}

/**
 * Regroupe et ordonne les critères : chapitre croissant, thématique croissante,
 * impératifs d'abord puis code croissant. Les groupes vides sont retirés — un
 * titre de chapitre sans ligne dessous annonce un contenu qui n'existe pas.
 */
export function groupCriteriaForPicker(
  criteria: readonly PickerCriterion[],
  options: PickerOptions = {}
): PickerChapterGroup[] {
  const query = (options.query ?? "").trim().toLocaleLowerCase("fr");

  const kept = criteria.filter(
    (criterion) =>
      (!options.imperativesOnly || criterion.requirementLevel === "IMPERATIF") &&
      matchesQuery(criterion, query)
  );

  const chapters = new Map<
    number,
    { name: string; themes: Map<string, { name: string; criteria: PickerCriterion[] }> }
  >();

  for (const criterion of kept) {
    let chapter = chapters.get(criterion.chapterNumber);
    if (!chapter) {
      chapter = { name: criterion.chapterName, themes: new Map() };
      chapters.set(criterion.chapterNumber, chapter);
    }
    let theme = chapter.themes.get(criterion.themeCode);
    if (!theme) {
      theme = { name: criterion.themeName, criteria: [] };
      chapter.themes.set(criterion.themeCode, theme);
    }
    theme.criteria.push(criterion);
  }

  return [...chapters.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, chapter]) => {
      const themes = [...chapter.themes.entries()]
        .sort(([a], [b]) => compareCriterionCodes(a, b))
        .map(([code, theme]) => {
          const sorted = [...theme.criteria].sort((a, b) => {
            const aImperative = a.requirementLevel === "IMPERATIF";
            const bImperative = b.requirementLevel === "IMPERATIF";
            if (aImperative !== bImperative) return aImperative ? -1 : 1;
            return compareCriterionCodes(a.code, b.code);
          });
          return { code, name: theme.name, criteria: sorted };
        })
        .filter((theme) => theme.criteria.length > 0);

      const all = themes.flatMap((theme) => theme.criteria);
      return {
        number,
        name: chapter.name,
        themes,
        criteriaCount: all.length,
        imperativesCount: all.filter((c) => c.requirementLevel === "IMPERATIF").length,
      };
    })
    .filter((chapter) => chapter.themes.length > 0);
}

/** Nombre total d'impératifs — ce que l'écran annonce avant de filtrer. */
export function countImperatives(criteria: readonly PickerCriterion[]): number {
  return criteria.filter((c) => c.requirementLevel === "IMPERATIF").length;
}
