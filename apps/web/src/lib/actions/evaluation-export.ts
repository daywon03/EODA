"use server";

import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { getEvaluationChapter, listChapters } from "./evaluation";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  buildEvaluationCsv,
  buildEvaluationExportFileName,
  summariseExport,
  type EvaluationExportRow,
} from "@/lib/services/evaluation-export-service";

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT DES COTATIONS — assemblage des lignes et production du fichier.
//
// Les lignes sont construites à partir de `getEvaluationChapter`, la MÊME lecture
// que l'écran de cotation : elle applique déjà le périmètre de l'offre
// (`offer-scope-service`), retrouve la session en cours et calcule les scores. Une
// seconde requête « spéciale export » finirait par exporter autre chose que ce que
// l'évaluatrice voit à l'écran (D1) — et c'est l'écran qui fait foi.
// ─────────────────────────────────────────────────────────────────────────────

export type EvaluationExportResult = {
  fileName: string;
  csv: string;
  summary: { elements: number; rated: number; imperatifsAtRisk: number };
};

export async function buildEvaluationExport(
  establishmentId: string
): Promise<EvaluationExportResult> {
  // Garde unique : identité + appartenance au tenant. Un identifiant reçu ici vient
  // d'une route HTTP publique (CLAUDE.md §5 bis).
  const { tenantId } = await requireEstablishmentInTenant(establishmentId);

  const establishment = await prisma.establishment.findFirst({
    where: { id: establishmentId, tenantId },
    select: { name: true },
  });
  if (!establishment) notFound();

  const chapters = await listChapters();

  const rows: EvaluationExportRow[] = [];
  for (const chapter of chapters) {
    const data = await getEvaluationChapter(establishmentId, chapter.number);

    for (const theme of data.themes) {
      for (const objective of theme.objectives) {
        for (const criterion of objective.criteria) {
          for (const element of criterion.elements) {
            rows.push({
              chapterNumber: data.chapter.number,
              chapterName: data.chapter.name,
              themeCode: theme.code,
              themeName: theme.name,
              objectiveCode: objective.code,
              criterionCode: criterion.code,
              criterionLabel: criterion.label,
              requirementLevel: criterion.requirementLevel,
              criterionScore: criterion.score,
              // Le texte reformulé s'il existe : c'est celui que l'évaluatrice a lu
              // en séance, donc celui que le fichier doit porter.
              elementText: element.reformulatedText ?? element.originalText,
              rating: element.rating,
              comment: element.comment,
              // `suggestedBySystem` d'une cotation ABSENTE est une suggestion non
              // confirmée : elle n'a rien à faire dans une colonne « origine » d'un
              // fichier de preuve. Seule une cotation posée peut être dite suggérée.
              suggestedBySystem: element.rating !== null && element.suggestedBySystem,
            });
          }
        }
      }
    }
  }

  const issuedOn = new Date();

  return {
    fileName: buildEvaluationExportFileName({
      structureName: establishment.name,
      issuedOn,
    }),
    csv: buildEvaluationCsv(rows),
    summary: summariseExport(rows),
  };
}

// Journalisation séparée de la construction : la page d'aperçu compte les lignes sans
// que ça constitue un export, seul le TÉLÉCHARGEMENT en est un. Confondre les deux
// remplirait le journal d'exports qui n'ont jamais quitté l'écran.
export async function recordEvaluationExport(establishmentId: string): Promise<void> {
  const { userId, session } = await requireEstablishmentInTenant(establishmentId);

  await recordAuditEvent({
    action: "EVALUATION_EXPORTED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId,
    detail: "Export CSV des cotations",
  });
}
