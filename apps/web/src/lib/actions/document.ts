"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  requireCabinetAdminSession,
  requireCabinetSession,
  requireEstablishmentAccess,
  tryCabinetSession,
  tryEstablishmentAccess,
} from "@/lib/auth/guards";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { canDeleteVersion,
  MAX_JUSTIFICATION_LENGTH,
} from "@/lib/services/document-workflow-service";
import { extractMarkdown } from "@/lib/services/text-extraction-service";
import { suggestDocumentType } from "@/lib/services/document-categorization-service";
import { ingestDocumentVersion } from "@/lib/services/document-ingestion-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { validateUploadedFile } from "@/lib/security/upload-validation-service";
import {
  getEstablishmentCoveredCategories,
  isCategoryCoveredForEstablishment,
} from "@/lib/services/establishment-offer-service";
import { getFileStoragePort } from "@/lib/storage";
import { getLLMAnalysisPort, isKnownLlmModelId } from "@/lib/llm";
import { validateGuidelineNote } from "@/lib/services/criterion-guideline-service";
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
  | { success: true; documentTypeId: string }
  | { error: string; needsManualType?: true; candidates?: DocumentTypeCandidate[] };

function revalidateDocumentViews(establishmentId: string): void {
  revalidatePath("/dashboard/client");
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
}

export async function uploadDocument(formData: FormData): Promise<UploadDocumentResult> {
  const establishmentId = formData.get("establishmentId");
  if (typeof establishmentId !== "string" || establishmentId.length === 0) {
    return { error: "Établissement manquant." };
  }

  // Autorisation avant toute lecture du fichier : ne jamais dépenser de l'I/O ni de
  // l'extraction de texte pour un appelant non habilité sur cet établissement.
  const access = await requireEstablishmentAccess(establishmentId);

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

  const extractedText = await extractMarkdown(buffer, validation.contentType);

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
      extractedText,
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

  revalidateDocumentViews(establishmentId);

  return { success: true, documentTypeId: documentType.id };
}

// Réponse Oui/Non + commentaire libre pour un document pas encore déposé —
// "Non" (ne concerne pas l'établissement) bascule le statut en NOT_APPLICABLE ;
// "Oui" (concerne l'établissement mais pas encore fourni) garde MISSING. Le
// commentaire est conservé dans les deux cas comme élément de preuve exploitable
// en cotation (Module 3).
export async function respondToMissingDocument(
  establishmentId: string,
  documentTypeId: string,
  applies: boolean,
  comment: string | null
): Promise<{ error: string } | null> {
  const access = await requireEstablishmentAccess(establishmentId);

  // Une réponse Oui/Non est une écriture : elle s'arrête avec le dépôt.
  if (!canDepositDocuments(access.missionAccess)) return { error: DEPOSIT_CLOSED_MESSAGE };

  const documentType = await prisma.documentType.findUnique({ where: { id: documentTypeId } });
  if (!documentType) return { error: "Type de document invalide." };

  // Même arbitrage que pour le dépôt : un document hors offre n'a pas à recevoir de
  // réponse Oui/Non, il n'est pas attendu. Sans mission, on ne bloque pas (avant-vente).
  if (!(await isCategoryCoveredForEstablishment(establishmentId, documentType.category))) {
    return { error: OUT_OF_OFFER_ERROR };
  }

  const trimmedComment = comment?.trim().slice(0, MAX_JUSTIFICATION_LENGTH) || null;
  const status = applies ? "MISSING" : "NOT_APPLICABLE";

  await prisma.document.upsert({
    where: { establishmentId_documentTypeId: { establishmentId, documentTypeId } },
    update: { status, missingJustification: trimmedComment, statusOverriddenByUser: !applies },
    create: {
      establishmentId,
      documentTypeId,
      status,
      missingJustification: trimmedComment,
      statusOverriddenByUser: !applies,
    },
  });

  await recordAuditEvent({
    action: "DOCUMENT_STATUS_ANSWERED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId,
    targetId: documentType.id,
    detail: `${documentType.code} → ${status}`,
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
  const access = await requireEstablishmentAccess(establishmentId);

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

// Résout une version de document en vérifiant l'habilitation sur SON établissement
// (et non sur un identifiant fourni par l'appelant) — c'est ce qui empêche de
// deviner un `documentVersionId` appartenant à un autre établissement.
async function getAuthorizedDocumentVersion(documentVersionId: string) {
  if (typeof documentVersionId !== "string" || documentVersionId.length === 0) return null;

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    include: { document: { select: { establishmentId: true, documentType: { select: { code: true } } } } },
  });
  if (!version) return null;

  const access = await tryEstablishmentAccess(version.document.establishmentId);
  if (!access) return null;

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

// Un navigateur ne sait afficher nativement qu'un PDF — un .docx est toujours
// proposé au téléchargement par le système, quel que soit le Content-Disposition.
// Pour les .docx, l'aperçu affiche donc le texte déjà extrait à l'upload
// (mammoth, cf. text-extraction-service) plutôt que le fichier brut.
export type { FilePreviewData as DocumentPreviewData } from "@/lib/services/file-preview-types";

export async function getDocumentPreviewData(
  documentVersionId: string
): Promise<FilePreviewData | null> {
  const authorized = await getAuthorizedDocumentVersion(documentVersionId);
  if (!authorized) return null;

  const { version, access } = authorized;

  await recordAuditEvent({
    action: "DOCUMENT_PREVIEWED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: version.document.establishmentId,
    targetId: version.id,
    detail: version.document.documentType?.code ?? null,
  });

  const isPdf = version.originalFilename.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    const url = await getFileStoragePort().getSignedDownloadUrl(version.fileStorageKey, {
      disposition: "inline",
      filename: version.originalFilename,
    });
    return { kind: "pdf", url, filename: version.originalFilename };
  }

  if (version.extractedText) {
    return { kind: "text", text: version.extractedText, filename: version.originalFilename };
  }

  return { kind: "unavailable", filename: version.originalFilename };
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
  const access = await requireEstablishmentAccess(version.document.establishmentId);
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

  try {
    await getFileStoragePort().delete(version.fileStorageKey);
  } catch (error) {
    console.error("Suppression de l'objet de stockage échouée — ligne conservée :", error);
    return {
      error:
        "Le fichier n'a pas pu être supprimé du stockage. Rien n'a été effacé : réessayez, et signalez l'incident si l'erreur persiste.",
    };
  }

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

  const access = await requireEstablishmentAccess(version.document.establishmentId);
  if (access.isClient) notFound();

  // Rien à publier : refuser plutôt que de poser une date de revue sur une analyse
  // inexistante, qui ferait croire à une relecture qui n'a pas eu lieu.
  if (reviewed && version.analysisResultJson === null) {
    return { error: "Aucune analyse à restituer pour cette version." };
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
export type CriterionOption = { id: string; code: string; label: string };

export type CriterionGuidelineItem = {
  id: string;
  note: string;
  createdAt: Date;
  createdByName: string;
};

export async function listCriteriaForPicker(): Promise<CriterionOption[] | null> {
  const cabinet = await tryCabinetSession();
  if (!cabinet) return null;

  const criteria = await prisma.criterion.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, label: true },
  });
  return criteria;
}

export async function addCriterionGuideline(
  criterionId: string,
  note: string
): Promise<{ error: string } | null> {
  const validated = validateGuidelineNote(note);
  if (!validated.ok) return { error: validated.error };

  const { tenantId, userId, session } = await requireCabinetSession();

  const criterion = await prisma.criterion.findUnique({ where: { id: criterionId }, select: { id: true } });
  if (!criterion) return { error: "Critère invalide." };

  await prisma.criterionGuideline.create({
    data: { tenantId, criterionId, note: validated.value, createdByUserId: userId },
  });

  await recordAuditEvent({
    action: "CRITERION_GUIDELINE_ADDED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: criterionId,
  });

  return null;
}

export async function listCriterionGuidelines(
  criterionId: string
): Promise<CriterionGuidelineItem[] | null> {
  const cabinet = await tryCabinetSession();
  if (!cabinet) return null;

  const guidelines = await prisma.criterionGuideline.findMany({
    where: { tenantId: cabinet.tenantId, criterionId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  return guidelines.map((g) => ({
    id: g.id,
    note: g.note,
    createdAt: g.createdAt,
    createdByName: g.createdBy.name,
  }));
}

// ── Validation d'un document ─────────────────────────────────────────────────
//
// Dernière étape du parcours (26/08) : « c'est complet quand tout est fait, quand
// c'est uploadé, analysé, modifié, relu et validé ». Réservée au CABINET : valider,
// c'est engager la parole de l'évaluatrice sur un document qui partira à la HAS.
// Réversible — une validation posée trop tôt doit pouvoir être retirée.
export async function setDocumentValidated(
  establishmentId: string,
  documentTypeId: string,
  validated: boolean
): Promise<{ error: string } | null> {
  if (typeof validated !== "boolean") return { error: "Valeur invalide." };

  const access = await requireEstablishmentAccess(establishmentId);
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
  return null;
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
