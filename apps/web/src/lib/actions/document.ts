"use server";

import { prisma, Prisma, type DocumentCategory } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  requireCabinetAdminSession,
  requireCabinetSession,
  requireEstablishmentAccess,
  tryCabinetSession,
  tryEstablishmentAccess,
} from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { notifyDocumentAvailable, notifyStructureActivity } from "@/lib/email/notifications";
import {
  canClientRead,
  canDepositDocuments,
  type MissionAccessState,
} from "@/lib/services/mission-access-service";
import {
  canDeleteVersion,
  MAX_JUSTIFICATION_LENGTH,
} from "@/lib/services/document-workflow-service";
import { isVersionVisibleToClient } from "@/lib/services/deliverables-service";
import { decideAnalysisDirective } from "@/lib/services/analysis-directive-service";
import { extractMarkdown } from "@/lib/services/text-extraction-service";
import { canRenderDocumentPages } from "@/lib/services/file-type-service";
// Le module de CACHE, pas le service de rendu : celui-ci importe Chromium, et cette
// action est chargée par toutes les pages qui touchent aux documents.
import { deleteCachedDocumentPdf } from "@/lib/services/document-pdf-cache";
import { suggestDocumentType } from "@/lib/services/document-categorization-service";
import { ingestDocumentVersion, reanalyzeDocumentVersion } from "@/lib/services/document-ingestion-service";
import { saveCorrectedDraft } from "@/lib/services/document-generation-service";
import { generateCorrectionProposal } from "./correction-proposal";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";
import { validateUploadedFile } from "@/lib/security/upload-validation-service";
import {
  getEstablishmentCoveredCategories,
  isCategoryCoveredForEstablishment,
} from "@/lib/services/establishment-offer-service";
import {
  missingAnswerError,
  missingAnswerWrite,
  parseMissingAnswer,
} from "@/lib/services/missing-answer-service";
import { getFileStoragePort } from "@/lib/storage";
import { getLLMAnalysisPort, isKnownLlmModelId } from "@/lib/llm";
import { validateGuidelineNote } from "@/lib/services/criterion-guideline-service";
import { compareCriterionCodes } from "@/lib/services/criterion-picker-service";
import {
  CVS_CODE,
  PARTICIPATION_LINE_CODE,
  cvsNotConcernedError,
  parseParticipationForm,
} from "@/lib/services/participation-form-service";
import type { PickerCriterion } from "@/lib/services/criterion-picker-service";
import { buildFilePreview } from "@/lib/services/file-preview-service";
import type { FilePreviewData } from "@/lib/services/file-preview-types";

// Cette action reste volontairement mince : autorisation → validation → délégation
// au service d'ingestion → invalidation de cache. La séquence métier (versioning,
// stockage, analyse) vit dans document-ingestion-service.ts.

// Une catégorie documentaire hors offre est REFUSÉE, jamais « acceptée sans
// analyse » : accepter le fichier stockerait une donnée client et brûlerait un
// appel LLM pour un livrable qui n'a pas été souscrit. Le message ne révèle ni
// prix ni contenu des autres offres.
// Bibliothèque en lecture seule après la clôture (§12.5). Message explicite et non
// un `notFound()` : le client a toujours accès à ses documents, c'est l'écriture qui
// s'arrête — le dire évite un ticket « le bouton ne marche plus ».
const DEPOSIT_CLOSED_MESSAGE =
  "L'accompagnement est terminé : vos documents restent consultables, mais aucun nouveau dépôt n'est possible. Contactez votre consultant EODA pour rouvrir un accompagnement.";

const OUT_OF_OFFER_ERROR =
  "Ce document n'entre pas dans le périmètre de l'offre souscrite pour cet établissement.";

export type DocumentTypeCandidate = { id: string; label: string; category: string };

export type UploadDocumentResult =
  // `documentVersionId` : l'écran qui vient de déposer prépare aussitôt les pages de
  // l'aperçu (`?prepare=1`), pour que le premier « voir » tombe sur le cache.
  | { success: true; documentTypeId: string; documentVersionId: string }
  | { error: string; needsManualType?: true; candidates?: DocumentTypeCandidate[] };

function revalidateDocumentViews(establishmentId: string): void {
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/client/documents");
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
}

export async function uploadDocument(formData: FormData): Promise<UploadDocumentResult> {
  const establishmentId = formData.get("establishmentId");
  if (typeof establishmentId !== "string" || establishmentId.length === 0) {
    return { error: "Établissement manquant." };
  }

  // Autorisation avant toute lecture du fichier : ne jamais dépenser de l'I/O ni de
  // l'extraction de texte pour un appelant non habilité sur cet établissement.
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);

  // Fin de mission : la bibliothèque est en LECTURE SEULE (§12.5). Le refus est
  // ici, côté serveur, et pas seulement dans l'UI qui masque le bouton — une action
  // serveur est une route HTTP publique.
  if (!canDepositDocuments(access.missionAccess)) {
    return { error: DEPOSIT_CLOSED_MESSAGE };
  }

  // Périmètre documentaire de l'offre contractée, résolu juste après la garde et
  // AVANT toute écriture : il filtre les candidats à la détection automatique et
  // arbitre le refus final. `null` = aucune mission, donc aucun périmètre contracté
  // ⇒ on ne bloque pas (état d'avant-vente, exactement la règle de buildChecklist
  // dans checklist.ts — les deux DOIVENT s'accorder, sinon le parcours d'avant-vente
  // affiche une checklist qu'aucun dépôt ne peut honorer).
  const coveredCategories = await getEstablishmentCoveredCategories(establishmentId);

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Aucun fichier sélectionné." };

  const buffer = Buffer.from(await file.arrayBuffer());

  // Le type réel est déterminé par la signature binaire, jamais par `file.type`
  // (valeur fournie par le client, donc falsifiable).
  const validation = validateUploadedFile(buffer, file.size);
  if (!validation.ok) return { error: validation.error };

  const extraction = await extractMarkdown(buffer, validation.contentType);
  // Les images éventuellement extraites sont stockées plus loin, à l'intérieur de
  // `ingestDocumentVersion` (seule cette fonction connaît le numéro de version) —
  // ici on ne garde que le texte, pour la catégorisation automatique ci-dessous.
  const extractedText = extraction ? extraction.markdown : null;
  const extractedImages = extraction ? extraction.images : [];

  const requestedTypeId = formData.get("documentTypeId");
  let documentTypeId = typeof requestedTypeId === "string" && requestedTypeId ? requestedTypeId : null;

  if (!documentTypeId) {
    // Restreint au périmètre de l'offre : sans ce filtre, la liste de candidats
    // renvoyée à l'UI énumérerait des types de documents que l'offre exclut.
    const allTypes = await prisma.documentType.findMany({
      where: coveredCategories ? { category: { in: [...coveredCategories] } } : {},
      select: { id: true, code: true, label: true, category: true },
    });
    const suggestion = suggestDocumentType(allTypes, file.name, extractedText);
    if (!suggestion) {
      return {
        error: "Type de document non détecté automatiquement — merci de le sélectionner.",
        needsManualType: true,
        candidates: allTypes.map(({ id, label, category }) => ({ id, label, category })),
      };
    }
    documentTypeId = suggestion.documentTypeId;
  }

  const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!documentType) return { error: "Type de document invalide." };

  // Refus AVANT ingestion : rien n'est stocké, aucune analyse n'est déclenchée.
  // `documentTypeId` peut venir du formulaire (entrée non fiable) : le contrôle
  // porte sur la catégorie réellement lue en base, pas sur ce qui a été envoyé.
  if (coveredCategories && !coveredCategories.includes(documentType.category)) {
    return { error: OUT_OF_OFFER_ERROR };
  }

  // Entrée non fiable (S8) : un identifiant de modèle hors du catalogue figé est
  // ignoré plutôt que transmis tel quel — l'adaptateur appliquera son défaut.
  const requestedModelId = formData.get("modelId");
  const modelId =
    typeof requestedModelId === "string" && isKnownLlmModelId(requestedModelId)
      ? requestedModelId
      : null;

  const result = await ingestDocumentVersion(
    {
      establishmentId,
      documentTypeId: documentType.id,
      documentTypeLabel: documentType.label,
      content: buffer,
      contentType: validation.contentType,
      originalFilename: file.name,
      uploadedByUserId: access.userId,
      documentOrigin: access.isClient ? "CLIENT" : "CABINET",
      extractedText,
      extractedImages,
      modelId,
    },
    { storage: getFileStoragePort(), llm: getLLMAnalysisPort() }
  );

  await recordAuditEvent({
    action: "DOCUMENT_UPLOADED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: result.documentVersionId,
    detail: documentType.code,
  });

  // VERSION FINALE D'EODA (call du 18/10/2026) : quand le cabinet dépose le document
  // qu'il a lui-même finalisé, le faire repasser par « À relire » demandait à Sandrine
  // de relire son propre travail. Coché au dépôt (par défaut côté cabinet), le dépôt
  // VAUT validation — même effet et même trace que `setDocumentValidated`. Décoché,
  // c'est un dépôt POUR LE COMPTE de la structure (un original du client), qui suit le
  // parcours normal : on ne valide jamais en silence une pièce que personne n'a relue.
  // Jamais pour un client : le champ est ignoré si l'appelant n'est pas du cabinet.
  if (!access.isClient && formData.get("cabinetFinal") === "1") {
    const now = new Date();
    const validatedDocument = await prisma.$transaction(async (tx) => {
      await tx.documentVersion.update({
        where: { id: result.documentVersionId },
        data: { analysisReviewedAt: now },
      });
      return tx.document.update({
        where: { establishmentId_documentTypeId: { establishmentId, documentTypeId: documentType.id } },
        data: { validatedAt: now, validatedByUserId: access.userId },
        select: { id: true },
      });
    });
    await recordAuditEvent({
      action: "DOCUMENT_VALIDATED",
      actorUserId: access.userId,
      actorRole: access.session.user.role,
      establishmentId,
      targetId: validatedDocument.id,
    });
  }

  revalidateDocumentViews(establishmentId);

  // Dépôt du cabinet sur un document DÉJÀ validé : la nouvelle version devient le
  // livrable sur-le-champ (deliverables-service prend la dernière version d'EODA),
  // donc le client est prévenu comme à la validation. Un dépôt sur un document non
  // validé ne prévient personne : c'est un travail en cours, et l'annoncer serait
  // promettre à la place de la consultante — l'annonce part quand elle valide.
  if (!access.isClient) {
    const document = await prisma.document.findUnique({
      where: { establishmentId_documentTypeId: { establishmentId, documentTypeId: documentType.id } },
      select: { validatedAt: true },
    });
    if (document?.validatedAt) {
      await announceValidatedDocument(establishmentId, documentType.id, access.missionAccess);
    }
  }

  // Dépôt du CLIENT : le cabinet est prévenu (16/10/2026). Sans cet envoi, une pièce
  // arrivée ne se découvre qu'en rouvrant la fiche — donc jamais le jour même. Le
  // dépôt du cabinet, lui, ne s'annonce pas à lui-même (branche ci-dessus).
  if (access.isClient) {
    await notifyStructureActivity({
      establishmentId,
      documentLabel: documentType.label,
      kind: "DEPOSIT",
    });
  }

  return { success: true, documentTypeId: documentType.id, documentVersionId: result.documentVersionId };
}

// Réponse sur un document pas encore déposé (missing-answer-service, N3) :
//   - WILL_PROVIDE  « il existe, pas encore déposé »   → MISSING ;
//   - DONT_HAVE     « Je ne l'ai pas »                → MISSING, à produire — il reste
//                   visible, il ne bascule JAMAIS en NOT_APPLICABLE ;
//   - NOT_CONCERNED « ne nous concerne pas »          → NOT_APPLICABLE, refusé sur les
//                   sept documents de la loi 2002-2.
// Le commentaire est conservé comme élément de preuve exploitable en cotation.
export async function respondToMissingDocument(
  establishmentId: string,
  documentTypeId: string,
  rawAnswer: unknown,
  comment: string | null
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);

  // Une réponse est une écriture : elle s'arrête avec le dépôt.
  if (!canDepositDocuments(access.missionAccess)) return { error: DEPOSIT_CLOSED_MESSAGE };

  // Entrée non fiable : jamais castée (CLAUDE.md §5 bis).
  const answer = parseMissingAnswer(rawAnswer);
  if (!answer) return { error: "Réponse invalide." };

  const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!documentType) return { error: "Type de document invalide." };

  // Même arbitrage que pour le dépôt : un document hors offre n'a pas à recevoir de
  // réponse, il n'est pas attendu. Sans mission, on ne bloque pas (avant-vente).
  if (!(await isCategoryCoveredForEstablishment(establishmentId, documentType.category))) {
    return { error: OUT_OF_OFFER_ERROR };
  }

  const refusal = missingAnswerError(answer, documentType.category, documentType.code);
  if (refusal) return { error: refusal };

  // CVS « Non concerné » : seulement une fois l'autre forme de participation choisie
  // (participation-form-service) — lue sur le document de SA ligne, pour CETTE structure.
  if (answer === "NOT_CONCERNED" && documentType.code === CVS_CODE) {
    const participation = await prisma.document.findFirst({
      where: { establishmentId, documentType: { code: PARTICIPATION_LINE_CODE } },
      select: { participationForm: true },
    });
    const cvsRefusal = cvsNotConcernedError(documentType.code, participation?.participationForm ?? null);
    if (cvsRefusal) return { error: cvsRefusal };
  }

  const trimmedComment = comment?.trim().slice(0, MAX_JUSTIFICATION_LENGTH) || null;
  const { status, statusOverriddenByUser } = missingAnswerWrite(answer);

  await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    update: { status, missingJustification: trimmedComment, statusOverriddenByUser },
    create: {
      establishmentId,
      documentTypeId,
      status,
      missingJustification: trimmedComment,
      statusOverriddenByUser,
    },
  });

  await recordAuditEvent({
    action: "DOCUMENT_STATUS_ANSWERED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentType.id,
    // La RÉPONSE et non le seul statut : « Je ne l'ai pas » et « il arrive » donnent
    // tous deux MISSING. Clés techniques, jamais le commentaire libre.
    detail: `${documentType.code} → ${answer}`,
  });

  revalidateDocumentViews(establishmentId);

  // « Je ne l'ai pas » n'est pas une absence, c'est une COMMANDE : le document est à
  // produire par EODA (N3), et le cabinet l'apprend par e-mail (16/10/2026). Les deux
  // autres réponses ne demandent aucun travail — « il arrive » et « ne nous concerne
  // pas » ne préviennent personne : une alerte par clic cesse d'être lue.
  if (answer === "DONT_HAVE") {
    await notifyStructureActivity({
      establishmentId,
      documentLabel: documentType.label,
      kind: "DECLARED_MISSING",
    });
  }

  return null;
}

// ── Forme de participation des usagers (21/10/2026) ──────────────────────────
// Choisie sur la ligne « Autre forme de participation des usagers » par la structure
// ou par le cabinet (c'est la démarche de la structure ; le cabinet peut la corriger).
// Même garde que l'écriture d'un commentaire. Crée la ligne si elle n'existe pas encore
// (statut « à déposer » : choisir une forme ne vaut pas dépôt). Le libellé libre n'est
// jamais recopié dans le journal.
export async function setParticipationForm(
  establishmentId: string,
  rawForm: string,
  rawOtherLabel: string | null
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  if (!canDepositDocuments(access.missionAccess)) return { error: DEPOSIT_CLOSED_MESSAGE };

  const parsed = parseParticipationForm(rawForm, rawOtherLabel);
  if (!parsed.ok) return { error: parsed.error };

  const documentType = await prisma.documentType.findUnique({
    where: { code: PARTICIPATION_LINE_CODE },
    select: { id: true, category: true },
  });
  if (!documentType) return { error: "La ligne « Autre forme de participation » n'existe pas dans le référentiel." };
  if (!(await isCategoryCoveredForEstablishment(establishmentId, documentType.category))) {
    return { error: OUT_OF_OFFER_ERROR };
  }

  await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId: documentType.id } },
    update: { participationForm: parsed.form, participationOtherLabel: parsed.otherLabel },
    create: {
      establishmentId,
      documentTypeId: documentType.id,
      status: "MISSING",
      participationForm: parsed.form,
      participationOtherLabel: parsed.otherLabel,
    },
  });

  await recordAuditEvent({
    action: "PARTICIPATION_FORM_SET",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentType.id,
    detail: parsed.form,
  });

  revalidateDocumentViews(establishmentId);
  return null;
}

// ── Correction de la justification « document manquant » ─────────────────────
// La justification n'était éditable QUE tant qu'aucune version n'existait : une
// erreur de saisie devenait définitive au premier dépôt. Cette action la corrige
// sans jamais toucher au statut — c'est ce qui la distingue de
// respondToMissingDocument() ci-dessus, qui, lui, arbitre MISSING/NOT_APPLICABLE.
// Les fusionner rendrait possible de repasser un document déposé en NOT_APPLICABLE
// par un simple commentaire.
export async function updateMissingJustification(
  establishmentId: string,
  documentTypeId: string,
  comment: string | null
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);

  if (!canDepositDocuments(access.missionAccess)) return { error: DEPOSIT_CLOSED_MESSAGE };

  const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!documentType) return { error: "Type de document invalide." };

  if (!(await isCategoryCoveredForEstablishment(establishmentId, documentType.category))) {
    return { error: OUT_OF_OFFER_ERROR };
  }

  const trimmedComment = comment?.trim().slice(0, MAX_JUSTIFICATION_LENGTH) || null;

  await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    update: { missingJustification: trimmedComment },
    // Aucune ligne encore : le commentaire précède le dépôt, le document reste
    // manquant. On ne fabrique surtout pas un statut à partir d'un commentaire.
    create: { establishmentId, documentTypeId, status: "MISSING", missingJustification: trimmedComment },
  });

  await recordAuditEvent({
    action: "DOCUMENT_JUSTIFICATION_UPDATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentType.id,
    detail: documentType.code,
  });

  revalidateDocumentViews(establishmentId);
  return null;
}

// « Pris en compte par l'IA » pour le commentaire de ce document (21/10/2026). Même
// garde que l'écriture du commentaire : qui peut l'écrire peut décider s'il est remis
// à l'analyse. S'applique à la PROCHAINE analyse (« Réanalyser »).
export async function setDocumentCommentAiUse(
  establishmentId: string,
  documentTypeId: string,
  enabled: boolean
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  if (!canDepositDocuments(access.missionAccess)) return { error: DEPOSIT_CLOSED_MESSAGE };

  const document = await prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    select: { id: true, commentUsedByAi: true, documentType: { select: { code: true } } },
  });
  if (!document) return { error: "Aucun commentaire sur ce document." };
  const value = enabled === true;
  if (document.commentUsedByAi === value) return null;

  await prisma.document.update({ where: { id: document.id }, data: { commentUsedByAi: value } });
  await recordAuditEvent({
    action: "DOCUMENT_COMMENT_AI_TOGGLED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentTypeId,
    detail: `${document.documentType?.code ?? "?"} · ${value ? "oui" : "non"}`,
  });
  revalidateDocumentViews(establishmentId);
  return null;
}


// ── Reclasser un document sous un autre type ─────────────────────────────────
//
// « Quand ce n'est pas un compte-rendu de CVS et que c'est une enquête de
// satisfaction, il faut pouvoir le changer, et l'analyse doit le savoir » (Damon,
// 20/10/2026). Le classement initial vient d'une devinette (suggestDocumentType) ou
// d'un choix fatigué au dépôt ; il ne pouvait plus être corrigé, et tout le reste en
// dépendait : la checklist qui l'affiche, les critères rattachés à son type, donc
// l'analyse.
//
// Ce que l'action change : le TYPE sous lequel le document est rangé. Ce qu'elle
// DÉTRUIT, volontairement : l'analyse et ses traces, qui portaient sur un autre type
// et deviendraient un mensonge (« couvert au regard des critères X » alors que le
// document est maintenant rangé sous Y). Les fichiers, les versions et l'historique
// restent intacts : on re-classe un document, on ne le redépose pas.
//
// Elle ne relance pas l'analyse elle-même : c'est un appel payant, et le geste de la
// consultante est de relire le nouveau classement avant qu'on redemande au modèle.
// L'écran le dit (« analyse effacée — relancer »), le bouton Analyser existant suffit.
export async function changeDocumentType(
  establishmentId: string,
  fromDocumentTypeId: string,
  toDocumentTypeId: string
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  if (!canDepositDocuments(access.missionAccess)) return { error: DEPOSIT_CLOSED_MESSAGE };

  if (fromDocumentTypeId === toDocumentTypeId) return null;

  const [from, to] = await Promise.all([
    prisma.documentType.findUnique({ where: { id: fromDocumentTypeId }, select: { id: true, code: true, category: true } }),
    prisma.documentType.findUnique({ where: { id: toDocumentTypeId }, select: { id: true, code: true, category: true } }),
  ]);
  if (!from || !to) return { error: "Type de document invalide." };

  // Même arbitrage que le dépôt : on ne re-classe pas sous un type que l'offre de la
  // structure ne couvre pas — le document disparaîtrait de sa checklist.
  if (!(await isCategoryCoveredForEstablishment(establishmentId, to.category))) {
    return { error: OUT_OF_OFFER_ERROR };
  }

  const document = await prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId: from.id } },
    select: { id: true },
  });
  if (!document) return { error: "Ce document n'est pas encore déposé : il n'y a rien à reclasser." };

  // `@@unique([establishmentId, documentTypeId])` : sans ce contrôle, la contrainte
  // tomberait dans le `catch` et l'écran annoncerait une panne technique là où le
  // problème est un simple conflit de rangement.
  const target = await prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId: to.id } },
    select: { id: true },
  });
  if (target) {
    return {
      error: `Un document existe déjà sous « ${to.code} » pour cette structure : supprimez-le ou fusionnez-les avant de reclasser.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: document.id },
      data: {
        documentTypeId: to.id,
        // Le document redevient « déposé, non analysé » : sa validation et
        // l'acceptation du client portaient sur un autre classement.
        status: "UPLOADED",
        statusOverriddenByUser: false,
        missingJustification: null,
        validatedAt: null,
        validatedByUserId: null,
        clientAcceptedAt: null,
        clientAcceptedByUserId: null,
      },
    });

    // L'analyse portait sur les critères de l'ANCIEN type : elle est effacée, pas
    // conservée « au cas où » — une analyse affichée sous le mauvais type est pire
    // qu'une absence d'analyse.
    await tx.documentVersion.updateMany({
      where: { documentId: document.id },
      data: {
        analysisResultJson: Prisma.DbNull,
        analysisReviewedAt: null,
        analysisReviewedByUserId: null,
        analysisDirectiveUsed: null,
      },
    });

    // Suggestions de critères calculées pour l'ancien type : elles n'ont plus de sens.
    await tx.documentCriterionSuggestion.deleteMany({ where: { documentId: document.id } });
  });

  await recordAuditEvent({
    action: "DOCUMENT_TYPE_CHANGED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: document.id,
    // Codes, jamais les libellés libres ni un nom de fichier.
    detail: `${from.code} -> ${to.code}`,
  });

  revalidateDocumentViews(establishmentId);
  return null;
}

// ── Consigne de la consultante sur l'analyse d'un document ───────────────────
//
// Même demande (20/10/2026) : « dans la partie commentaire du document, ce serait
// bien de pouvoir lui donner des précisions pour l'analyse, et de pouvoir les prendre
// en compte ou non avec un bouton ». La consigne est CONSERVÉE quand le bouton est
// éteint — c'est une note de travail, pas un champ qu'on efface pour la désactiver.
//
// Ce n'est pas un guide de cotation : le prompt (analysis-prompt.ts) la traite comme
// un contexte à consulter, qui ne peut ni changer le rôle du modèle ni le faire
// conclure. Le texte libre n'est JAMAIS recopié dans le journal d'audit : il peut
// citer une situation de personne accompagnée.
// La règle (longueur, refus d'une consigne vide activée) et la constante vivent dans
// `lib/services/analysis-directive-service.ts` : ce fichier porte `"use server"`, donc
// il ne peut exporter que des fonctions asynchrones — et une règle recopiée dans un
// composant finirait par diverger de celle du serveur.
export async function updateAnalysisDirective(
  establishmentId: string,
  documentTypeId: string,
  directive: string,
  includeInAnalysis: boolean
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  if (!canDepositDocuments(access.missionAccess)) return { error: DEPOSIT_CLOSED_MESSAGE };

  const decision = decideAnalysisDirective(directive, includeInAnalysis);
  if ("error" in decision) return { error: decision.error };

  const documentType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, code: true, category: true },
  });
  if (!documentType) return { error: "Type de document invalide." };

  if (!(await isCategoryCoveredForEstablishment(establishmentId, documentType.category))) {
    return { error: OUT_OF_OFFER_ERROR };
  }

  await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    update: {
      analysisDirective: decision.directive,
      directiveInAnalysis: decision.includeInAnalysis,
    },
    // Aucune ligne encore (document pas déposé) : la consigne attend le dépôt, et le
    // document reste manquant — jamais un statut fabriqué à partir d'une note.
    create: {
      establishmentId,
      documentTypeId,
      status: "MISSING",
      analysisDirective: decision.directive,
      directiveInAnalysis: decision.includeInAnalysis,
    },
  });

  await recordAuditEvent({
    action: "DOCUMENT_DIRECTIVE_UPDATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentType.id,
    // Le drapeau et le code, jamais le texte de la consigne.
    detail: `${documentType.code} → ${decision.includeInAnalysis ? "prise en compte" : "ignorée"}`,
  });

  revalidateDocumentViews(establishmentId);
  return null;
}

// Types proposés au reclassement : ceux des catégories couvertes par l'offre de CETTE
// structure. Rendus depuis le serveur plutôt que recopiés dans un composant (D1) — la
// liste change avec le catalogue et avec l'offre souscrite.
export async function listDocumentTypeOptions(
  establishmentId: string
): Promise<{ id: string; label: string; category: DocumentCategory }[] | null> {
  const access = await tryEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  if (!access) return null;

  const categories = await getEstablishmentCoveredCategories(establishmentId);
  return prisma.documentType.findMany({
    where: categories ? { category: { in: [...categories] } } : {},
    select: { id: true, label: true, category: true },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });
}

// Résout une version de document en vérifiant l'habilitation sur SON établissement
// (et non sur un identifiant fourni par l'appelant) — c'est ce qui empêche de
// deviner un `documentVersionId` appartenant à un autre établissement.
async function getAuthorizedDocumentVersion(documentVersionId: string) {
  if (typeof documentVersionId !== "string" || documentVersionId.length === 0) return null;

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    include: {
      // `validatedAt` et l'auteur de la version : la règle de restitution ci-dessous
      // a besoin des deux, et les relire ailleurs ferait diverger les portes.
      uploadedBy: { select: { role: true } },
      document: {
        select: {
          establishmentId: true,
          validatedAt: true,
          documentType: { select: { code: true } },
        },
      },
    },
  });
  if (!version) return null;

  const access = await tryEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_READ);
  if (!access) return null;

  // Un brouillon produit par le cabinet n'est pas lisible par la structure avant
  // validation du document (deliverables-service — même règle que la carte de
  // « Mes documents » et que la route PDF). La structure reçoit l'historique des
  // versions dans sa page : leurs identifiants ne sont donc pas un secret, et
  // masquer un bouton ne protégerait rien.
  if (
    access.isClient &&
    !isVersionVisibleToClient({
      producedByCabinet: version.uploadedBy.role !== "CLIENT_USER",
      validatedAt: version.document.validatedAt,
    })
  ) {
    return null;
  }

  return { version, access };
}

export async function getDocumentDownloadUrl(documentVersionId: string): Promise<string | null> {
  const authorized = await getAuthorizedDocumentVersion(documentVersionId);
  if (!authorized) return null;

  const { version, access } = authorized;

  await recordAuditEvent({
    action: "DOCUMENT_DOWNLOADED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: version.document.documentType?.code ?? null,
  });

  return getFileStoragePort().getSignedDownloadUrl(version.fileStorageKey, {
    disposition: "attachment",
    filename: version.originalFilename,
  });
}

// Un navigateur ne sait afficher nativement qu'un PDF et une image. Pour tout le
// reste — et l'essentiel de ce que déposent les structures est en `.docx` — les pages
// sont PRODUITES côté serveur (document-pdf-service) puis affichées par le lecteur PDF
// du navigateur (16/10/2026). Le Markdown extrait reste le repli des formats qu'aucun
// convertisseur ne prend en charge.
export type { FilePreviewData as DocumentPreviewData } from "@/lib/services/file-preview-types";

export async function getDocumentPreviewData(
  documentVersionId: string
): Promise<FilePreviewData | null> {
  const authorized = await getAuthorizedDocumentVersion(documentVersionId);
  if (!authorized) return null;

  const { version, access } = authorized;

  const documentPagesUrl = canRenderDocumentPages(version.originalFilename)
    ? `/api/documents/${version.id}/pdf`
    : null;

  // L'audit suit ce qui sert les OCTETS, une fois par accès. Ici on ne remet qu'une
  // adresse : quand elle mène à notre route, c'est la route qui journalise, à
  // l'instant où elle rend les pages — journaliser aussi l'affichage de la modale
  // compterait deux fois un seul clic. Pour un PDF ou une image, l'adresse signée
  // mène au stockage, hors de notre portée : la révélation de cette adresse est le
  // seul point de journalisation que nous ayons, et c'est celui-ci.
  if (!documentPagesUrl) {
    await recordAuditEvent({
      action: "DOCUMENT_PREVIEWED",
      actorUserId: access.userId,
      actorRole: access.session.user.role,
      establishmentId: version.document.establishmentId,
      targetId: version.id,
      detail: version.document.documentType?.code ?? null,
    });
  }

  return buildFilePreview({
    originalFilename: version.originalFilename,
    fileStorageKey: version.fileStorageKey,
    extractedText: version.extractedText,
    documentPagesUrl,
  });
}

// ── Texte extrait (Markdown) — vérification de l'extraction, côté CABINET ────
//
// Contrairement à `getDocumentPreviewData` ci-dessus (qui ne montre le texte extrait
// que pour les formats qu'un navigateur ne sait pas rendre nativement), celui-ci
// montre TOUJOURS le texte extrait, y compris pour un PDF — c'est exactement ce que
// l'IA a reçu à analyser, et c'est ce que Sandrine doit pouvoir comparer à l'original
// pour repérer une extraction manquée (page scannée, tableau mal reconnu) avant de
// faire confiance à une analyse qui s'appuierait dessus.
//
// Réservé au cabinet : c'est un outil de vérification interne du pipeline IA, pas une
// pièce à restituer au client.
export type ExtractedTextData =
  | { text: string; filename: string }
  | { error: string };

export async function getExtractedText(documentVersionId: string): Promise<ExtractedTextData | null> {
  const authorized = await getAuthorizedDocumentVersion(documentVersionId);
  if (!authorized) return null;

  const { version, access } = authorized;
  if (access.isClient) return null;

  if (!version.extractedText) {
    return { error: "Aucun texte n'a pu être extrait de ce document (format image, ou extraction échouée)." };
  }

  return { text: version.extractedText, filename: version.originalFilename };
}


// ── Suppression d'une version de document ────────────────────────────────────
// Un fichier déposé sur le mauvais établissement — donc le document d'un AUTRE
// client — ne pouvait qu'être enterré sous une nouvelle version, et l'objet restait
// dans le stockage. Sur des données de santé/social, c'est un défaut RGPD.
//
// Réservé au CABINET (requireEstablishmentInTenant) : un client peut déposer et
// consulter, il ne décide pas de l'effacement d'une pièce du dossier de sa propre
// structure. La suppression est définitive et non annulable.
//
// ORDRE : l'objet de stockage D'ABORD, la ligne ENSUITE.
//   - stockage supprimé, base en échec  → une ligne pointe un objet absent : anomalie
//     visible, réparable, et surtout aucune donnée client ne survit ;
//   - base supprimée, stockage en échec → le fichier reste dans le bucket sans plus
//     aucune trace pour le retrouver : c'est précisément le défaut qu'on corrige.
// Un échec de suppression de l'objet interrompt donc l'opération et rend une erreur ;
// la ligne n'est jamais effacée « quand même ».
export async function deleteDocumentVersion(
  documentVersionId: string
): Promise<{ error: string } | null> {
  if (typeof documentVersionId !== "string" || documentVersionId.length === 0) {
    return { error: "Version de document invalide." };
  }

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    include: {
      document: {
        select: {
          id: true,
          establishmentId: true,
          currentVersionId: true,
          documentType: { select: { code: true } },
        },
      },
    },
  });
  if (!version) return { error: "Version de document introuvable." };

  // L'identifiant vient d'une route HTTP publique : l'habilitation porte sur
  // l'établissement PROPRIÉTAIRE de la version, jamais sur un identifiant fourni.
  // `requireEstablishmentAccess` ouvre aux deux côtés — le client doit pouvoir
  // corriger son propre dépôt — et notFound() tombe si la version est hors périmètre.
  const access = await requireEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_WRITE);
  const { session, userId } = access;

  // Chacun ne supprime que ce qu'il a déposé, et seulement la dernière version.
  const uploader = await prisma.user.findUnique({
    where: { id: version.uploadedByUserId },
    select: { role: true },
  });
  const allowed = canDeleteVersion({
    actorIsCabinet: !access.isClient,
    versionProducedByCabinet: uploader?.role !== "CLIENT_USER",
    isLatest: version.document.currentVersionId === version.id,
  });
  if (!allowed) {
    return {
      error: access.isClient
        ? "Vous ne pouvez retirer que votre dernier dépôt. Contactez votre consultant EODA pour toute autre correction."
        : "Seules les versions produites par le cabinet peuvent être supprimées, et uniquement la dernière. Un document déposé par le client lui appartient.",
    };
  }

  // Récupérées AVANT la transaction : le cascade Prisma (onDelete: Cascade) va
  // supprimer les lignes DocumentVersionImage, mais jamais les objets qu'elles
  // pointent dans le stockage — sans quoi ils restent orphelins dans le bucket,
  // porteurs potentiels de données personnelles (droit à l'effacement).
  const imageKeys = (
    await prisma.documentVersionImage.findMany({
      where: { documentVersionId: version.id },
      select: { fileStorageKey: true },
    })
  ).map((image) => image.fileStorageKey);

  try {
    await getFileStoragePort().delete(version.fileStorageKey);
  } catch (error) {
    console.error("Suppression de l'objet de stockage échouée — ligne conservée :", error);
    return {
      error:
        "Le fichier n'a pas pu être supprimé du stockage. Rien n'a été effacé : réessayez, et signalez l'incident si l'erreur persiste.",
    };
  }

  // Best-effort, image par image : contrairement au fichier principal ci-dessus,
  // l'échec de suppression d'une image ne bloque JAMAIS la suppression du
  // document — ce ne sont que des objets déjà orphelins en base une fois le
  // cascade passé, pas la pièce que le cabinet ou le client vient de retirer.
  for (const imageKey of imageKeys) {
    try {
      await getFileStoragePort().delete(imageKey);
    } catch (error) {
      console.error("Suppression d'une image de document échouée — objet orphelin dans le stockage :", error);
    }
  }

  // Les pages rendues pour l'aperçu sont DÉRIVÉES de la pièce qui vient d'être
  // supprimée : elles partent avec elle, pour la même raison que les images
  // ci-dessus (droit à l'effacement — un PDF garde le texte du document). Best-effort
  // lui aussi, et il le faut : la plupart des versions n'ont jamais été ouvertes en
  // aperçu, donc n'ont aucun rendu à supprimer.
  await deleteCachedDocumentPdf(version.id);

  await prisma.$transaction(async (tx) => {
    // Versions régénérées à partir de celle-ci : le lien de filiation est coupé
    // plutôt que de faire échouer la suppression sur une contrainte de clé étrangère.
    await tx.documentVersion.updateMany({
      where: { regeneratedFromVersionId: version.id },
      data: { regeneratedFromVersionId: null },
    });

    if (version.document.currentVersionId === version.id) {
      const previous = await tx.documentVersion.findFirst({
        where: { documentId: version.documentId, id: { not: version.id } },
        orderBy: { versionNumber: "desc" },
        select: { id: true },
      });

      await tx.document.update({
        where: { id: version.documentId },
        data: previous
          ? {
              currentVersionId: previous.id,
              // Le statut décrivait l'analyse de la version supprimée. La version
              // remise en courant redevient « déposée » : un fichier est bien là,
              // sa conformité n'est plus établie tant qu'elle n'est pas réanalysée.
              status: "UPLOADED",
              statusOverriddenByUser: false,
            }
          : {
              // Dernière version supprimée : le document redevient MANQUANT. Le laisser
              // COMPLIANT sans aucun fichier produirait une checklist qui ment, et un
              // critère HAS coté sur une preuve inexistante.
              currentVersionId: null,
              status: "MISSING",
              statusOverriddenByUser: false,
            },
      });
    }

    await tx.documentVersion.delete({ where: { id: version.id } });
  });

  await recordAuditEvent({
    action: "DOCUMENT_VERSION_DELETED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: version.document.documentType?.code ?? null,
  });

  revalidateDocumentViews(version.document.establishmentId);
  return null;
}

// ── Revue humaine d'une analyse avant restitution ────────────────────────────
//
// « Aucune analyse de conformité automatisée ne doit être présentée au client sans
// revue préalable de la consultante » (CDC du 20/08/2026, §5 et §7). L'analyse est
// produite à chaque dépôt ; c'est ce geste-ci qui la rend visible côté client.
//
// Réservé au CABINET : `requireEstablishmentAccess` ouvre aux deux côtés, on refuse
// donc explicitement le client. Sans ce refus, un compte client pourrait publier
// lui-même l'analyse de ses propres documents — c'est-à-dire contourner exactement
// la revue que le cahier des charges impose.
export async function setAnalysisReviewed(
  documentVersionId: string,
  reviewed: boolean
): Promise<{ error: string } | null> {
  if (typeof reviewed !== "boolean") return { error: "Valeur invalide." };

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: {
      id: true,
      analysisResultJson: true,
      analysisReviewedAt: true,
      document: { select: { establishmentId: true } },
    },
  });
  if (!version) notFound();

  const access = await requireEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_WRITE);
  if (access.isClient) notFound();

  // Rien à publier : refuser plutôt que de poser une date de revue sur une analyse
  // inexistante, qui ferait croire à une relecture qui n'a pas eu lieu.
  if (reviewed && version.analysisResultJson === null) {
    return { error: "Aucune analyse à restituer pour cette version." };
  }
  // Une analyse ILLISIBLE (appel interrompu, adaptateur de repli, JSON vide) ne se
  // marque pas relue : la structure lirait « Relu par EODA » sur une analyse qui ne
  // dit rien (test de bout en bout du 12/10). Même lecture que l'écran.
  if (reviewed && parseAnalysisResult(version.analysisResultJson) === null) {
    return {
      error:
        "Cette analyse est illisible : il faut relancer l'analyse d'abord, depuis la fiche de la structure, avant de la marquer relue.",
    };
  }

  if (reviewed === (version.analysisReviewedAt !== null)) return null;

  await prisma.documentVersion.update({
    where: { id: version.id },
    data: {
      analysisReviewedAt: reviewed ? new Date() : null,
      analysisReviewedByUserId: reviewed ? access.userId : null,
    },
  });

  await recordAuditEvent({
    action: reviewed ? "ANALYSIS_PUBLISHED" : "ANALYSIS_UNPUBLISHED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
  });

  revalidateDocumentViews(version.document.establishmentId);
  return null;
}

// ── Analyser / réanalyser à la demande ───────────────────────────────────────
//
// « Il faut un bouton analyser » (Damon, 15/09/2026) — deux raisons de vouloir
// déclencher l'analyse manuellement plutôt que de compter sur le seul dépôt :
// rattraper une version dont l'extraction avait échoué (cf.
// reanalyzeDocumentVersion pour l'incident précis), et pouvoir comparer un autre
// modèle après coup. Réservé au cabinet, comme setAnalysisReviewed ci-dessus.
export async function reanalyzeDocument(
  documentVersionId: string,
  modelId?: string | null
): Promise<{ error: string } | null> {
  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: { document: { select: { establishmentId: true, documentType: { select: { code: true } } } } },
  });
  if (!version) notFound();

  const access = await requireEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_WRITE);
  if (access.isClient) notFound();

  const validatedModelId = modelId && isKnownLlmModelId(modelId) ? modelId : null;

  const result = await reanalyzeDocumentVersion(
    documentVersionId,
    { storage: getFileStoragePort(), llm: getLLMAnalysisPort() },
    validatedModelId
  );

  if ("error" in result) return { error: result.error };

  await recordAuditEvent({
    action: "DOCUMENT_REANALYZED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: documentVersionId,
    detail: version.document.documentType?.code ?? null,
  });

  revalidateDocumentViews(version.document.establishmentId);
  return null;
}

// ── Guidelines du cabinet sur l'analyse IA ───────────────────────────────────
//
// « Que la base de connaissance apprenne des commentaires que mettra Sandrine lors
// des analyses, pour ne pas refaire les mêmes erreurs » (Damon, 10/09/2026), ANCRÉES
// SUR LE CRITÈRE HAS plutôt que le type de document — cf. CriterionGuideline dans le
// schéma pour le raisonnement complet, et specs/04-liaison-document-type-critere.md
// pour la limite actuelle : `document_type_criteria` est vide, donc le critère ne se
// déduit pas encore automatiquement du document analysé. En attendant, la
// consultante choisit elle-même le critère concerné dans la liste — d'où
// `listCriteriaForPicker` ci-dessous.
//
// Réservé au cabinet, tenant entier (comme la bibliothèque de modèles) : PAS lié à
// un établissement ni à une version de document précise, contrairement à
// setAnalysisReviewed ci-dessus — une guideline vaut pour tous les clients.
//
// Append-only : aucune action de modification ni de suppression n'est exposée. Une
// guideline est une leçon retenue à une date donnée, pas un champ à corriger.
// Forme unique, partagée avec le rangement par chapitre et thématique : l'écran de
// sélection a besoin du numéro de chapitre et du code de thématique pour grouper, et
// deux formes parallèles finiraient par diverger (call du 20/09 : « les 157 critères…
// j'ai mal à la tête »).
export type CriterionOption = PickerCriterion;

export type CriterionGuidelineItem = {
  id: string;
  note: string;
  // Prise en compte par l'IA (call du 18/10/2026) — le texte, lui, ne change jamais.
  aiEnabled: boolean;
  createdAt: Date;
  createdByName: string;
};

export async function listCriteriaForPicker(): Promise<CriterionOption[] | null> {
  const cabinet = await tryCabinetSession("STRUCTURES_READ");
  if (!cabinet) return null;

  // Chapitre et thématique sont lus avec le critère, pas recopiés côté client : le
  // rangement doit suivre le référentiel en base le jour où le manuel HAS évolue.
  const criteria = await prisma.criterion.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      label: true,
      requirementLevel: true,
      objective: {
        select: {
          theme: {
            select: {
              code: true,
              name: true,
              chapter: { select: { number: true, name: true } },
            },
          },
        },
      },
    },
  });

  // Ordre NUMÉRIQUE (1.2 avant 1.10) — la base trie les codes comme du texte
  // (21/10/2026 : « mets les critères dans le bon ordre, du plus petit au plus grand »).
  return [...criteria].sort((a, b) => compareCriterionCodes(a.code, b.code)).map((criterion) => ({
    id: criterion.id,
    code: criterion.code,
    label: criterion.label,
    requirementLevel: criterion.requirementLevel,
    chapterNumber: criterion.objective.theme.chapter.number,
    chapterName: criterion.objective.theme.chapter.name,
    themeCode: criterion.objective.theme.code,
    themeName: criterion.objective.theme.name,
  }));
}

// Une guideline sur PLUSIEURS critères en un seul enregistrement (21/10/2026 : « pouvoir
// en sélectionner plusieurs et appuyer sur Enregistrer avant de lancer l'analyse »). Une
// ligne par critère — la guideline reste ancrée au critère (CriterionGuideline) — dans
// UNE transaction : tout ou rien. Les identifiants reçus sont relus en base.
const MAX_GUIDELINE_CRITERIA = 40;

export async function addCriterionGuidelines(
  criterionIds: string[],
  note: string,
  aiEnabled = true
): Promise<{ error: string } | { saved: number }> {
  const validated = validateGuidelineNote(note);
  if (!validated.ok) return { error: validated.error };

  const { tenantId, userId, session } = await requireCabinetSession("STRUCTURES_WRITE");

  const unique = [...new Set(Array.isArray(criterionIds) ? criterionIds.filter((id) => typeof id === "string") : [])];
  if (unique.length === 0) return { error: "Cochez au moins un critère." };
  if (unique.length > MAX_GUIDELINE_CRITERIA) return { error: `Au plus ${MAX_GUIDELINE_CRITERIA} critères à la fois.` };

  const criteria = await prisma.criterion.findMany({ where: { id: { in: unique } }, select: { id: true, code: true } });
  if (criteria.length !== unique.length) return { error: "Un critère coché n'existe pas dans le référentiel." };

  await prisma.criterionGuideline.createMany({
    data: criteria.map((criterion) => ({
      tenantId,
      criterionId: criterion.id,
      note: validated.value,
      aiEnabled: aiEnabled === true,
      createdByUserId: userId,
    })),
  });

  for (const criterion of criteria) {
    await recordAuditEvent({
      action: "CRITERION_GUIDELINE_ADDED",
      actorUserId: userId,
      actorRole: session.user.role,
      targetId: criterion.id,
    });
  }
  return { saved: criteria.length };
}

export async function listCriterionGuidelines(
  criterionId: string
): Promise<CriterionGuidelineItem[] | null> {
  const cabinet = await tryCabinetSession("STRUCTURES_READ");
  if (!cabinet) return null;

  const guidelines = await prisma.criterionGuideline.findMany({
    where: { tenantId: cabinet.tenantId, criterionId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  return guidelines.map((g) => ({
    id: g.id,
    note: g.note,
    aiEnabled: g.aiEnabled,
    createdAt: g.createdAt,
    createdByName: g.createdBy.name,
  }));
}

// « Oui ou non pris en compte par l'IA » : seul l'USAGE d'une guideline se bascule,
// jamais son texte (append-only). Tenant de l'appelant obligatoire — une guideline
// d'un autre cabinet répond notFound(), comme tout objet hors périmètre.
export async function setCriterionGuidelineAiUse(
  guidelineId: string,
  aiEnabled: boolean
): Promise<{ error: string } | null> {
  const { tenantId, userId, session } = await requireCabinetSession("STRUCTURES_WRITE");
  if (typeof guidelineId !== "string" || guidelineId.length === 0) return { error: "Guideline manquante." };

  const guideline = await prisma.criterionGuideline.findFirst({
    where: { id: guidelineId, tenantId },
    select: { id: true, aiEnabled: true },
  });
  if (!guideline) notFound();
  const enabled = aiEnabled === true;
  if (guideline.aiEnabled === enabled) return null;

  await prisma.criterionGuideline.update({ where: { id: guideline.id }, data: { aiEnabled: enabled } });
  await recordAuditEvent({
    action: "CRITERION_GUIDELINE_AI_TOGGLED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: guideline.id,
    detail: enabled ? "oui" : "non",
  });
  return null;
}

// ── Validation d'un document ─────────────────────────────────────────────────
//
// Dernière étape du parcours (26/08) : « c'est complet quand tout est fait, quand
// c'est uploadé, analysé, modifié, relu et validé ». Réservée au CABINET : valider,
// c'est engager la parole de l'évaluatrice sur un document qui partira à la HAS.
// Réversible — une validation posée trop tôt doit pouvoir être retirée.
export type SetDocumentValidatedResult =
  | { error: string }
  // Validation posée : combien d'interlocuteurs du client ont été prévenus par
  // e-mail, pour que l'écran le dise au lieu de laisser croire que c'est parti.
  | { notified: { sent: number; total: number } }
  | null;

export async function setDocumentValidated(
  establishmentId: string,
  documentTypeId: string,
  validated: boolean
): Promise<SetDocumentValidatedResult> {
  if (typeof validated !== "boolean") return { error: "Valeur invalide." };

  const access = await requireEstablishmentAccess(establishmentId, NEED.DOCUMENTS_WRITE);
  if (access.isClient) notFound();

  const document = await prisma.document.findUnique({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    select: { id: true, validatedAt: true, currentVersionId: true },
  });
  if (!document) return { error: "Ce document n'a pas encore été déposé." };

  // Valider un document sans version reviendrait à valider une intention.
  if (validated && document.currentVersionId === null) {
    return { error: "Aucune version déposée : il n'y a rien à valider." };
  }
  if (validated === (document.validatedAt !== null)) return null;

  await prisma.document.update({
    where: { id: document.id },
    data: {
      validatedAt: validated ? new Date() : null,
      validatedByUserId: validated ? access.userId : null,
    },
  });

  await recordAuditEvent({
    action: validated ? "DOCUMENT_VALIDATED" : "DOCUMENT_UNVALIDATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: document.id,
  });

  revalidateDocumentViews(establishmentId);

  // Retirer une validation ne prévient personne : le document disparaît des
  // livrables, on n'écrit pas au client pour lui annoncer un retour en arrière.
  if (!validated) return null;
  const notified = await announceValidatedDocument(
    establishmentId,
    documentTypeId,
    access.missionAccess
  );
  return { notified };
}

// Prévenir le client qu'un document validé l'attend — par e-mail ; dans
// l'application, la pastille « Mes livrables » se dérive seule
// (deliverables-service).
//
// NON exporté, et c'est une règle de sécurité : tout export d'un fichier
// "use server" est une route HTTP publique. Les appelants ont déjà passé la garde.
//
// Un accès RÉVOQUÉ ne reçoit rien : on n'invite pas à ouvrir un portail qui est
// fermé. La bibliothèque (mission clôturée) reste lisible, elle, donc prévenue.
async function announceValidatedDocument(
  establishmentId: string,
  documentTypeId: string,
  missionAccess: MissionAccessState
): Promise<{ sent: number; total: number }> {
  if (!canClientRead(missionAccess)) return { sent: 0, total: 0 };

  const [establishment, document] = await Promise.all([
    prisma.establishment.findUnique({ where: { id: establishmentId }, select: { name: true } }),
    prisma.document.findUnique({
      where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
      select: {
        documentType: { select: { label: true } },
        // Existe-t-il une version produite par EODA ? C'est ce qui sépare un
        // livrable d'une pièce du client simplement jugée conforme — même critère
        // que deliverables-service (auteur non CLIENT_USER).
        versions: {
          where: { uploadedBy: { role: { not: "CLIENT_USER" } } },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);
  if (!establishment || !document?.documentType) return { sent: 0, total: 0 };

  return notifyDocumentAvailable({
    establishmentId,
    establishmentName: establishment.name,
    documentLabel: document.documentType.label,
    kind: document.versions.length > 0 ? "DELIVERABLE" : "VALIDATED_PIECE",
  });
}

// ── Réclamé au client, ou produit par EODA ───────────────────────────────────
//
// « Ce n'est pas à eux de me les envoyer, c'est à moi de les créer pour eux. » Le
// drapeau vit sur le TYPE de document, pas sur l'établissement : c'est une politique
// de cabinet (« voilà ce que nous réclamons »), pas une exception par client. Sandrine
// consulte ses experts sur la liste exacte — elle doit pouvoir la corriger sans
// migration, d'où cette action.
//
// Réservée à CABINET_ADMIN : la liste vaut pour tous les clients.
export async function setDocumentTypeRequested(
  documentTypeId: string,
  requested: boolean
): Promise<{ error: string } | null> {
  const { session, userId } = await requireCabinetAdminSession();
  if (typeof requested !== "boolean") return { error: "Valeur invalide." };

  const documentType = await prisma.documentType.findUnique({
    where: { id: documentTypeId },
    select: { id: true, code: true, requestedFromClient: true },
  });
  if (!documentType) notFound();
  if (documentType.requestedFromClient === requested) return null;

  await prisma.documentType.update({
    where: { id: documentType.id },
    data: { requestedFromClient: requested },
  });

  await recordAuditEvent({
    action: "DOCUMENT_TYPE_SCOPE_CHANGED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: documentType.id,
    detail: `${documentType.code} → ${requested ? "réclamé au client" : "produit par EODA"}`,
  });

  // La checklist change des DEUX côtés : le client cesse de le voir, ou le découvre.
  revalidatePath("/dashboard/client");
  revalidatePath("/dashboard/cabinet");
  return null;
}

// ── Brouillon de document corrigé, généré par l'IA ───────────────────────────
//
// « Quand l'analyse est faite, le document est généré par l'IA […] brandé EODA,
// qu'ils pourront réutiliser ensuite » (Damon, 15/09/2026). Réservé au cabinet,
// comme reanalyzeDocument ci-dessus : c'est un brouillon de travail, jamais
// montré au client tel quel — aucune analyse ni document généré n'atteint le
// client sans revue humaine (CLAUDE.md, même règle que setAnalysisReviewed).

const MAX_DRAFT_MARKDOWN_LENGTH = 200_000;

export type CorrectedDraft = { markdown: string; generatedAt: Date } | null;

export async function getCorrectedDraft(documentVersionId: string): Promise<CorrectedDraft | undefined> {
  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: {
      correctedDraftMarkdown: true,
      correctedDraftGeneratedAt: true,
      document: { select: { establishmentId: true } },
    },
  });
  if (!version) return undefined;

  const access = await tryEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_READ);
  if (!access || access.isClient) return undefined;

  if (!version.correctedDraftMarkdown || !version.correctedDraftGeneratedAt) return null;
  return { markdown: version.correctedDraftMarkdown, generatedAt: version.correctedDraftGeneratedAt };
}

// Délègue à la mise en conformité structurée (N8, lib/actions/correction-proposal.ts) :
// même garde (correction-context), même droit (correctionRight), même trace — une
// seule porte de génération, que l'appel vienne du panneau cabinet ou de l'écran
// côte à côte.
export async function generateDocumentDraft(
  documentVersionId: string,
  modelId?: string | null
): Promise<{ error: string } | null> {
  return generateCorrectionProposal(documentVersionId, modelId);
}

export async function saveDocumentDraft(
  documentVersionId: string,
  markdown: string
): Promise<{ error: string } | null> {
  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    return { error: "Le document ne peut pas être vide." };
  }
  if (markdown.length > MAX_DRAFT_MARKDOWN_LENGTH) {
    return { error: "Ce document dépasse la taille maximale autorisée." };
  }

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: { document: { select: { establishmentId: true, documentType: { select: { code: true } } } } },
  });
  if (!version) notFound();

  const access = await requireEstablishmentAccess(version.document.establishmentId, NEED.DOCUMENTS_WRITE);
  if (access.isClient) notFound();

  await saveCorrectedDraft(documentVersionId, markdown.trim());

  await recordAuditEvent({
    action: "CORRECTED_DRAFT_EDITED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: documentVersionId,
    detail: version.document.documentType?.code ?? null,
  });

  revalidateDocumentViews(version.document.establishmentId);
  return null;
}
