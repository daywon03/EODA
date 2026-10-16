// Seed du référentiel HAS réel (137 critères, 295 E.E., grilles SAD aide) — source : les
// 3 grilles Synaé `Grille Chapitre {1,2,3} … .xlsx` dans `.claude/context/Documents/`
// (non committées au dépôt — leur nom porte celui d'un vrai client, cf. CLAUDE.md §7 :
// on les retrouve par leur préfixe, jamais par un nom écrit en dur).
// Les critères propres au SAD mixte ne sont PAS dans ces grilles (manuel HAS, champ
// médico-social) : ils sont chargés à la fin, depuis `src/seed-data.ts` — la même
// donnée que la migration `20261011110000_sad_mixte_criteria`, qui sur une base neuve
// s'exécute avant que les objectifs existent et n'insère donc rien.
// Idempotent (upsert par clé stable) — cf. context/05-prototype-existant.md.
import path from "node:path";
import { existsSync, readdirSync } from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient, RequirementLevel } from "@prisma/client";
import { seedSadMixteCriteria } from "../src/seed-steps";

const DOCUMENTS_DIR = path.join(__dirname, "..", "..", "..", ".claude", "context", "Documents");

type ChapterSource = { number: number; method: string; filename: string };

const CHAPTER_METHODS: ReadonlyArray<{ number: number; method: string }> = [
  { number: 1, method: "Accompagné traceur" },
  { number: 2, method: "Traceur ciblé" },
  { number: 3, method: "Audit système" },
];

// Un fichier par chapitre, reconnu par son préfixe « Grille Chapitre N » et son
// extension. Nom vide si absent : le contrôle d'existence le signale.
function resolveChapterSources(): ChapterSource[] {
  const files = existsSync(DOCUMENTS_DIR) ? readdirSync(DOCUMENTS_DIR) : [];
  return CHAPTER_METHODS.map(({ number, method }) => ({
    number,
    method,
    filename:
      files.find((f) => f.startsWith(`Grille Chapitre ${number} `) && f.endsWith(".xlsx")) ?? "",
  }));
}

// La colonne O de l'en-tête s'intitule « Critère ID ». Les trois grilles ne placent PAS
// leur en-tête sur la même ligne (ligne 4 au chapitre 1, ligne 3 aux chapitres 2 et 3) :
// l'ancienne lecture à `range: 3` enregistrait donc, au chapitre 1, la ligne d'en-tête
// comme un critère de code « Critère ID » (le « 137/138 » du bilan du 08/10 ; nettoyé en
// base par la migration `20261011100000_drop_seed_header_criterion`). On cherche
// désormais l'en-tête, et une ligne dont le code n'a pas la forme N.N.N est ignorée.
const HEADER_CRITERION_ID = "Critère ID";
const CRITERION_CODE_PATTERN = /^\d+\.\d+\.\d+$/;

function readDataRows(sheet: XLSX.WorkSheet): unknown[][] {
  const all: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headerIndex = all.findIndex(
    (row) => String(row?.[COL.ID_CRITERE] ?? "").trim() === HEADER_CRITERION_ID
  );
  if (headerIndex < 0) {
    throw new Error(`En-tête « ${HEADER_CRITERION_ID} » introuvable dans la grille.`);
  }
  return all
    .slice(headerIndex + 1)
    .filter((row) => CRITERION_CODE_PATTERN.test(String(row?.[COL.ID_CRITERE] ?? "").trim()));
}

// Colonnes (0-indexées) de la feuille "Grille d'évaluation Synaé" — vérifié par
// exploration manuelle des 3 fichiers. Les données suivent la ligne d'en-tête.
const COL = {
  CHAPITRE_LABEL: 0,
  THEME_LABEL: 1,
  OBJECTIF_LABEL: 2,
  CRITERE_LABEL: 3,
  INTITULE: 4,
  NIVEAU: 6,
  IS_QUESTION: 10,
  ID_CHAPITRE: 11,
  ID_THEME: 12,
  ID_OBJECTIF: 13,
  ID_CRITERE: 14,
  ID_QUESTION: 15,
} as const;

// Liste de référence (context/02-referentiel-has.md §4) — assertion de sanité pour
// détecter tout écart silencieux si les fichiers source venaient à changer.
const EXPECTED_IMPERATIFS: Record<number, string[]> = {
  1: [],
  2: ["2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.2.6", "2.2.7"],
  3: [
    "3.11.1", "3.11.2",
    "3.12.1", "3.12.2", "3.12.3",
    "3.13.1", "3.13.2", "3.13.3",
    "3.14.1", "3.14.2",
  ],
};

export async function seedHasReferential(prisma: PrismaClient): Promise<void> {
  const CHAPTERS = resolveChapterSources();
  const missingFiles = CHAPTERS.filter(
    (c) => c.filename === "" || !existsSync(path.join(DOCUMENTS_DIR, c.filename))
  );
  if (missingFiles.length > 0) {
    console.warn(
      `⚠️  Référentiel HAS non seedé — grilles absentes (chapitres ${missingFiles
        .map((c) => c.number)
        .join(", ")}). Attendu dans .claude/context/Documents/ (non committé, cf. CLAUDE.md §7).`
    );
    return;
  }

  const referentialVersion = await prisma.hasReferentialVersion.upsert({
    where: { id: "has-referentiel-juillet-2025" },
    update: {},
    create: {
      id: "has-referentiel-juillet-2025",
      label: "Manuel HAS juillet 2025",
      effectiveDate: new Date("2025-07-08"),
    },
  });

  for (const chapterSource of CHAPTERS) {
    const filePath = path.join(DOCUMENTS_DIR, chapterSource.filename);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
    const rows = readDataRows(sheet);

    // Pas de contrainte unique composite sur Chapter en base — upsert manuel par recherche
    // (referentialVersionId + number identifie un chapitre de façon stable).
    const chapterName = `Chapitre ${chapterSource.number}`;
    const existingChapter = await prisma.chapter.findFirst({
      where: { referentialVersionId: referentialVersion.id, number: chapterSource.number },
    });
    const chapter = existingChapter
      ? await prisma.chapter.update({
          where: { id: existingChapter.id },
          data: { name: chapterName, method: chapterSource.method },
        })
      : await prisma.chapter.create({
          data: {
            referentialVersionId: referentialVersion.id,
            number: chapterSource.number,
            name: chapterName,
            method: chapterSource.method,
          },
        });

    const themeCache = new Map<string, string>(); // code thématique -> id
    const objectiveCache = new Map<string, string>(); // code objectif -> id
    const criterionCache = new Map<string, string>(); // code critère -> id

    let criterionRows = 0;
    let eeRows = 0;
    const imperatifsSeen = new Set<string>();

    // Passe 1 — Chapitre/Thématique/Objectif/Critère (lignes non-E.E.)
    for (const row of rows) {
      if (!row || !row[COL.CRITERE_LABEL]) continue;
      if (row[COL.IS_QUESTION] === "true") continue; // ligne E.E., traitée en passe 2

      const themeCode = String(row[COL.ID_THEME]);
      const themeName = String(row[COL.THEME_LABEL]);
      const objectiveCode = String(row[COL.ID_OBJECTIF]);
      const criterionCode = String(row[COL.ID_CRITERE]).trim();
      const criterionLabel = String(row[COL.INTITULE]);
      const niveau = row[COL.NIVEAU] === "Impératif" ? RequirementLevel.IMPERATIF : RequirementLevel.STANDARD;

      let themeId = themeCache.get(themeCode);
      if (!themeId) {
        const theme = await prisma.theme.upsert({
          where: { chapterId_code: { chapterId: chapter.id, code: themeCode } },
          update: { name: themeName },
          create: { chapterId: chapter.id, code: themeCode, name: themeName },
        });
        themeId = theme.id;
        themeCache.set(themeCode, themeId);
      }

      let objectiveId = objectiveCache.get(objectiveCode);
      if (!objectiveId) {
        const objective = await prisma.objective.upsert({
          where: { themeId_code: { themeId, code: objectiveCode } },
          update: {},
          create: { themeId, code: objectiveCode },
        });
        objectiveId = objective.id;
        objectiveCache.set(objectiveCode, objectiveId);
      }

      const criterion = await prisma.criterion.upsert({
        where: { code: criterionCode },
        update: { label: criterionLabel, requirementLevel: niveau, objectiveId, applicableTo: "BOTH" },
        create: {
          objectiveId,
          code: criterionCode,
          label: criterionLabel,
          requirementLevel: niveau,
          applicableTo: "BOTH",
        },
      });
      criterionCache.set(criterionCode, criterion.id);
      criterionRows++;
      if (niveau === RequirementLevel.IMPERATIF) imperatifsSeen.add(criterionCode);
    }

    // Passe 2 — E.E., rattachés au critère déjà créé
    for (const row of rows) {
      if (!row || !row[COL.CRITERE_LABEL]) continue;
      if (row[COL.IS_QUESTION] !== "true") continue;

      const criterionCode = String(row[COL.ID_CRITERE]).trim();
      const criterionId = criterionCache.get(criterionCode);
      if (!criterionId) {
        throw new Error(`E.E. sans critère parent trouvé : ${criterionCode} (${chapterSource.filename})`);
      }

      const sourceQuestionId = row[COL.ID_QUESTION] ? String(row[COL.ID_QUESTION]) : null;
      const originalText = String(row[COL.INTITULE]);

      if (sourceQuestionId) {
        await prisma.evaluationElement.upsert({
          where: { sourceQuestionId },
          update: { originalText, criterionId, allowsRi: chapterSource.number === 1 },
          create: {
            criterionId,
            originalText,
            allowsRi: chapterSource.number === 1,
            sourceQuestionId,
          },
        });
      } else {
        // Pas d'ID stable — évite la duplication en cherchant un E.E. existant identique.
        const existing = await prisma.evaluationElement.findFirst({ where: { criterionId, originalText } });
        if (!existing) {
          await prisma.evaluationElement.create({
            data: { criterionId, originalText, allowsRi: chapterSource.number === 1 },
          });
        }
      }
      eeRows++;
    }

    const expected = EXPECTED_IMPERATIFS[chapterSource.number] ?? [];
    const actual = [...imperatifsSeen].sort();
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
      throw new Error(
        `Écart critères impératifs Chapitre ${chapterSource.number} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)} (cf. context/02-referentiel-has.md §4)`
      );
    }

    console.log(
      `  Chapitre ${chapterSource.number} (${chapterSource.method}) : ${criterionRows} critères, ${eeRows} E.E., ${actual.length} impératifs ✓`
    );
  }

  const sadMixte = await seedSadMixteCriteria({
    findObjectiveId: async (chapterNumber, objectiveCode) => {
      const objective = await prisma.objective.findFirst({
        where: {
          code: objectiveCode,
          theme: { chapter: { referentialVersionId: referentialVersion.id, number: chapterNumber } },
        },
        select: { id: true },
      });
      return objective?.id ?? null;
    },
    upsertCriterion: (args) => prisma.criterion.upsert(args),
  });
  console.log(`  SAD mixte : ${sadMixte.seeded.length} critères ✓`);
  if (sadMixte.skipped.length > 0) {
    console.warn(`⚠️  Critères SAD mixte sans objectif de rattachement : ${sadMixte.skipped.join(", ")}`);
  }
}
