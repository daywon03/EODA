"use server";

import { prisma } from "@eoda/database";
import { requireContentReviewSession } from "@/lib/auth/guards";
import { buildContentReviewCatalog, type ContentReviewCatalog } from "@/lib/services/content-review-service";
import {
  buildContentReviewCsv,
  buildContentReviewDocx,
  type ContentReviewFormat,
} from "@/lib/services/content-review-export-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";
import { formatDate } from "@/lib/services/date-format-service";

// ─────────────────────────────────────────────────────────────────────────────
// CONTENUS À VALIDER — lecture et export (CABINET_ADMIN et CABINET_EVALUATOR, par la
// capacité CONTENT_REVIEW). Aucune donnée de structure ni de personne : du contenu
// de la plateforme, plus les libellés des types de document (référentiel commun).
// ─────────────────────────────────────────────────────────────────────────────

async function loadCatalog(): Promise<ContentReviewCatalog> {
  const types = await prisma.documentType.findMany({ select: { code: true, label: true } });
  return buildContentReviewCatalog(new Map(types.map((type) => [type.code, type.label])));
}

export async function getContentReviewCatalog(): Promise<ContentReviewCatalog> {
  await requireContentReviewSession();
  return loadCatalog();
}

export type ContentReviewFile = { body: string | Buffer; fileName: string; contentType: string };

export async function buildContentReviewExport(format: ContentReviewFormat): Promise<ContentReviewFile> {
  await requireContentReviewSession();
  const catalog = await loadCatalog();
  const now = new Date();
  const fileName = buildEodaFileName({
    issuedOn: now,
    type: "CONTENUS",
    clientName: "EODA",
    objet: "Contenus-a-valider",
    audience: "Interne",
    extension: format,
  });
  if (format === "csv") {
    return { body: buildContentReviewCsv(catalog), fileName, contentType: "text/csv; charset=utf-8" };
  }
  return {
    body: await buildContentReviewDocx(catalog, formatDate(now)),
    fileName,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}
