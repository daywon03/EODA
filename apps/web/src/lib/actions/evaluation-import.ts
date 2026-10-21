"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { detectFileType, MAX_FILE_SIZE_BYTES, XLSX_MIME_TYPE } from "@/lib/security/upload-validation-service";
import { isCriterionLevelCovered } from "@/lib/services/offer-scope-service";
import { applicableToValuesFor } from "@/lib/services/criterion-applicability-service";
import { readFirstSheetAsText } from "@/lib/services/synae-workbook-reader";
import {
  describeSynaeImport,
  extractSynaeRows,
  planSynaeImport,
  synaeGridChapter,
  type SynaeElementFacts,
} from "@/lib/services/synae-grid-import-service";

export type SynaeImportResult = { error: string } | { chapterNumber: number; summary: string; refused: string[] };

// Import d'une grille Synaé cotée (décision de Damon, 21/10/2026). Cabinet, en
// ÉCRITURE, sur une structure de son périmètre. Les cotations vont dans la session
// OUVERTE du chapitre lu dans la grille — créée si aucune ne l'est : c'est le même
// geste explicite que « Ouvrir une session », jamais une session clôturée réécrite.
export async function importSynaeGrid(establishmentId: string, formData: FormData): Promise<SynaeImportResult> {
  const { userId, session, establishmentType } = await requireEstablishmentInTenant(establishmentId, "WRITE");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez la grille Synaé (fichier .xlsx)." };
  if (file.size > MAX_FILE_SIZE_BYTES) return { error: "Fichier trop volumineux." };
  const content = Buffer.from(await file.arrayBuffer());
  // Le type se décide par SIGNATURE, jamais par l'extension ni File.type.
  if (detectFileType(content) !== XLSX_MIME_TYPE) return { error: "Ce fichier n'est pas un classeur Excel (.xlsx)." };

  const sheet = await readFirstSheetAsText(content);
  const rows = sheet ? extractSynaeRows(sheet) : null;
  if (!rows) return { error: "Ce classeur n'a pas la forme d'une grille Synaé (colonne « Critère ID » introuvable)." };
  const chapterNumber = synaeGridChapter(rows);
  if (chapterNumber === null) return { error: "La grille doit porter un seul chapitre (1, 2 ou 3)." };

  const [chapter, mission] = await Promise.all([
    prisma.chapter.findFirst({ where: { number: chapterNumber }, select: { id: true } }),
    prisma.mission.findUnique({ where: { establishmentId }, select: { formule: true, gratuit: true } }),
  ]);
  if (!chapter) return { error: `Le chapitre ${chapterNumber} n'existe pas dans le référentiel chargé.` };
  // Sans mission, rien n'est contracté : même refus que la cotation à l'écran.
  if (!mission) return { error: "L'auto-évaluation nécessite une mission démarrée." };

  const applicable = applicableToValuesFor(establishmentType);
  const elements = await prisma.evaluationElement.findMany({
    where: { sourceQuestionId: { in: rows.map((r) => r.questionId) }, criterion: { objective: { theme: { chapterId: chapter.id } } } },
    select: { id: true, sourceQuestionId: true, criterion: { select: { requirementLevel: true, applicableTo: true } } },
  });
  const facts = new Map<string, SynaeElementFacts>(
    elements.flatMap((e): [string, SynaeElementFacts][] =>
      e.sourceQuestionId
        ? [
            [
              e.sourceQuestionId,
              {
                elementId: e.id,
                requirementLevel: e.criterion.requirementLevel,
                inScope:
                  applicable.includes(e.criterion.applicableTo) &&
                  isCriterionLevelCovered(mission.formule, mission.gratuit, e.criterion.requirementLevel),
              },
            ],
          ]
        : []
    )
  );

  // Session ouverte du chapitre, ou nouvelle.
  const open =
    (await prisma.evaluationSession.findFirst({
      where: { establishmentId, chapterId: chapter.id, finishedAt: null },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    })) ??
    (await prisma.evaluationSession.create({
      data: { establishmentId, chapterId: chapter.id, performedByUserId: userId },
      select: { id: true },
    }));

  const rated = await prisma.elementRating.findMany({
    where: { evaluationSessionId: open.id },
    select: { evaluationElementId: true },
  });
  const plan = planSynaeImport(rows, {
    chapterNumber,
    elements: facts,
    ratedElementIds: new Set(rated.map((r) => r.evaluationElementId)),
  });

  if (plan.toWrite.length > 0) {
    const now = new Date();
    await prisma.elementRating.createMany({
      data: plan.toWrite.map((w) => ({
        evaluationSessionId: open.id,
        evaluationElementId: w.elementId,
        rating: w.rating,
        comment: w.comment,
        // La grille a été cotée par un humain : c'est son geste, importé — pas une
        // suggestion du système.
        confirmedByUser: true,
        suggestedBySystem: false,
        ratedByUserId: userId,
        ratedAt: now,
      })),
      skipDuplicates: true,
    });
  }

  const summary = describeSynaeImport(plan);
  await recordAuditEvent({
    action: "EVALUATION_GRID_IMPORTED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId,
    targetId: open.id,
    detail: `chapitre ${chapterNumber} · +${plan.toWrite.length} · conservées ${plan.alreadyRated} · refusées ${plan.refused.length}`,
  });

  const base = `/dashboard/cabinet/etablissements/${establishmentId}/evaluation`;
  revalidatePath(base);
  revalidatePath(`${base}/chapitre/${chapterNumber}`);
  return {
    chapterNumber,
    summary,
    refused: plan.refused.map((r) => `${r.criterionCode} : ${r.reason}`),
  };
}
