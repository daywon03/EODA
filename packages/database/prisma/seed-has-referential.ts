// Seed du référentiel HAS réel (137/138 critères, 295 E.E.) — source : les 3 fichiers
// `Grille Chapitre {1,2,3}... SAA ASSAD BENOIT.xlsx` dans `.claude/context/Documents/`
// (non committés au repo — nom de fichier référence un vrai client, cf. CLAUDE.md §7).
// Idempotent (upsert par clé stable) — cf. context/05-prototype-existant.md.
import path from "node:path";
import { existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient, RequirementLevel } from "@prisma/client";

const DOCUMENTS_DIR = path.join(__dirname, "..", "..", "..", ".claude", "context", "Documents");

type ChapterSource = { number: number; method: string; filename: string };

const CHAPTERS: ChapterSource[] = [
  { number: 1, method: "Accompagné traceur", filename: "Grille Chapitre 1  Accompagné traceur  SAA ASSAD BENOIT.xlsx" },
  { number: 2, method: "Traceur ciblé", filename: "Grille Chapitre 2  Traceur ciblé  SAA ASSAD BENOIT.xlsx" },
  { number: 3, method: "Audit système", filename: "Grille Chapitre 3  Audit système  SAA ASSAD BENOIT.xlsx" },
];

// Colonnes (0-indexées) de la feuille "Grille d'évaluation Synaé", données à partir de la
// ligne 4 (1-indexée) — vérifié par exploration manuelle des 3 fichiers.
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
  const missingFiles = CHAPTERS.filter((c) => !existsSync(path.join(DOCUMENTS_DIR, c.filename)));
  if (missingFiles.length > 0) {
    console.warn(
      `⚠️  Référentiel HAS non seedé — fichiers source absents (${missingFiles
        .map((c) => c.filename)
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
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 3 });

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
      const criterionCode = String(row[COL.ID_CRITERE]);
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

      const criterionCode = String(row[COL.ID_CRITERE]);
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
}
