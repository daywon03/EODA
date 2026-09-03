"use server";

import { prisma, DocumentCategory, TemplateStage } from "@eoda/database";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetAdminSession, requireCabinetSession } from "@/lib/auth/guards";
import { firstError, optionalString, requiredEnum, requiredString } from "@/lib/validation/form-parsers";
import { validateUploadedFile } from "@/lib/security/upload-validation-service";
import { getFileStoragePort } from "@/lib/storage";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  buildTemplateStorageKey,
  compareVersionLabelsDesc,
  normaliseVersionLabel,
  templateDownloadFilename,
  versionLabelError,
} from "@/lib/services/template-library-service";

// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTHÈQUE DE MODÈLES EODA
//
// LECTURE : tout le cabinet (`requireCabinetSession`). Un futur collaborateur doit
// pouvoir partir du gabarit à jour — c'est l'objet même d'une bibliothèque.
//
// ÉCRITURE : `CABINET_ADMIN` seul. Publier une v1.3 d'un gabarit, c'est décider que
// tout le monde travaillera désormais dessus.
//
// JAMAIS de client, sous aucune forme. Rien ici n'est rattaché à un établissement, et
// aucune de ces actions n'est atteignable depuis le portail : ce sont les outils de
// travail d'EODA, pas des pièces de dossier.
// ─────────────────────────────────────────────────────────────────────────────

const LIBRARY_PATH = "/dashboard/cabinet/modeles";

export type TemplateSummary = {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string | null;
  versionCount: number;
  updatedAt: Date;
  // Stades pour lesquels au moins une version existe : c'est ce qui dit d'un coup
  // d'œil qu'il manque encore la version vierge d'un gabarit.
  stages: TemplateStage[];
};

export async function listTemplates(): Promise<TemplateSummary[]> {
  const { tenantId } = await requireCabinetSession();

  const templates = await prisma.templateDocument.findMany({
    where: { tenantId },
    orderBy: [{ category: "asc" }, { title: "asc" }],
    include: { versions: { select: { stage: true } } },
  });

  return templates.map((template) => ({
    id: template.id,
    title: template.title,
    category: template.category,
    description: template.description,
    versionCount: template.versions.length,
    updatedAt: template.updatedAt,
    stages: [...new Set(template.versions.map((v) => v.stage))],
  }));
}

export type TemplateDetail = {
  id: string;
  title: string;
  category: DocumentCategory;
  description: string | null;
  versions: {
    id: string;
    stage: TemplateStage;
    versionLabel: string;
    changeNote: string | null;
    originalFilename: string;
    sizeBytes: number;
    createdAt: Date;
    uploadedByName: string;
  }[];
};

export async function getTemplate(templateId: string): Promise<TemplateDetail> {
  const { tenantId } = await requireCabinetSession();

  // `templateId` arrive par une route HTTP publique : l'appartenance au tenant se
  // vérifie en base. `notFound()` et non `redirect()` — ne pas révéler qu'un
  // identifiant existe ailleurs.
  const template = await prisma.templateDocument.findFirst({
    where: { id: templateId, tenantId },
    include: {
      versions: { include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!template) notFound();

  return {
    id: template.id,
    title: template.title,
    category: template.category,
    description: template.description,
    // Tri par numéro de version décroissant, segment par segment : « v10 » vient
    // après « v9 », ce qu'un tri de chaînes ferait à l'envers.
    versions: [...template.versions]
      .sort((a, b) => compareVersionLabelsDesc(a.versionLabel, b.versionLabel))
      .map((version) => ({
        id: version.id,
        stage: version.stage,
        versionLabel: version.versionLabel,
        changeNote: version.changeNote,
        originalFilename: version.originalFilename,
        sizeBytes: version.sizeBytes,
        createdAt: version.createdAt,
        uploadedByName: version.uploadedBy.name,
      })),
  };
}

export async function createTemplate(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const title = requiredString(formData, "title", "Le titre du modèle", 200);
  const category = requiredEnum(formData, "category", "La catégorie", DocumentCategory);
  const description = optionalString(formData, "description", "La description", 1000);

  const error = firstError(title, category, description);
  if (error) return { error };
  if (!title.ok || !category.ok || !description.ok) return { error: "Formulaire invalide." };

  // Contrainte d'unicité rattrapée AVANT l'écriture, pour nommer le vrai problème :
  // laissée au `catch`, elle sortirait sous un message technique qui n'apprendrait
  // rien à la personne qui vient de saisir un titre.
  const existing = await prisma.templateDocument.findFirst({
    where: { tenantId, title: title.value },
    select: { id: true },
  });
  if (existing) {
    return { error: "Un modèle porte déjà ce titre. Ajoutez-lui plutôt une version." };
  }

  const template = await prisma.templateDocument.create({
    data: {
      tenantId,
      title: title.value,
      category: category.value,
      description: description.value,
    },
    select: { id: true },
  });

  revalidatePath(LIBRARY_PATH);
  redirect(`${LIBRARY_PATH}/${template.id}`);
}

export async function uploadTemplateVersion(
  templateId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const template = await prisma.templateDocument.findFirst({
    where: { id: templateId, tenantId },
    select: { id: true },
  });
  if (!template) notFound();

  const stage = requiredEnum(formData, "stage", "Le stade du document", TemplateStage);
  const rawLabel = requiredString(formData, "versionLabel", "Le numéro de version", 20);
  const changeNote = optionalString(formData, "changeNote", "La note de version", 500);

  const parseError = firstError(stage, rawLabel, changeNote);
  if (parseError) return { error: parseError };
  if (!stage.ok || !rawLabel.ok || !changeNote.ok) return { error: "Formulaire invalide." };

  const versionLabel = normaliseVersionLabel(rawLabel.value);
  const labelError = versionLabelError(versionLabel);
  if (labelError) return { error: labelError };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Aucun fichier sélectionné." };

  const buffer = Buffer.from(await file.arrayBuffer());
  // Type réel déterminé par la SIGNATURE BINAIRE, jamais par `file.type` — valeur
  // fournie par le client, donc falsifiable. Même règle que le dépôt de pièces.
  const validation = validateUploadedFile(buffer, file.size);
  if (!validation.ok) return { error: validation.error };

  const duplicate = await prisma.templateVersion.findFirst({
    where: { templateDocumentId: templateId, stage: stage.value, versionLabel },
    select: { id: true },
  });
  if (duplicate) {
    return { error: `La version ${versionLabel} existe déjà pour ce stade.` };
  }

  const storageKey = buildTemplateStorageKey({
    templateDocumentId: templateId,
    stage: stage.value,
    versionLabel,
    originalFilename: file.name,
    timestamp: Date.now(),
  });

  // Stockage AVANT la ligne en base : l'inverse laisserait une version référencée
  // sans fichier, c'est-à-dire un gabarit qui a l'air disponible et ne s'ouvre pas.
  // Un objet stocké sans ligne, lui, reste invisible et sans conséquence.
  await getFileStoragePort().upload(storageKey, buffer, validation.contentType);

  const version = await prisma.templateVersion.create({
    data: {
      templateDocumentId: templateId,
      stage: stage.value,
      versionLabel,
      changeNote: changeNote.value,
      fileStorageKey: storageKey,
      originalFilename: file.name,
      contentType: validation.contentType,
      sizeBytes: buffer.length,
      uploadedByUserId: userId,
    },
    select: { id: true },
  });

  // `detail` = le libellé de version, jamais le nom du fichier : celui-ci porte
  // souvent le nom d'une structure.
  await recordAuditEvent({
    action: "TEMPLATE_VERSION_UPLOADED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: version.id,
    detail: `${stage.value} ${versionLabel}`,
  });

  revalidatePath(LIBRARY_PATH);
  revalidatePath(`${LIBRARY_PATH}/${templateId}`);
  return null;
}

export async function getTemplateVersionDownloadUrl(versionId: string): Promise<string | null> {
  const { tenantId } = await requireCabinetSession();

  const version = await prisma.templateVersion.findFirst({
    // Le filtre remonte jusqu'au tenant par la fiche parente : un identifiant de
    // version d'un autre cabinet ne doit pas produire d'URL signée.
    where: { id: versionId, templateDocument: { tenantId } },
    include: { templateDocument: { select: { title: true } } },
  });
  if (!version) return null;

  return getFileStoragePort().getSignedDownloadUrl(version.fileStorageKey, {
    disposition: "attachment",
    // Nom conforme à la convention EODA plutôt que le nom d'origine : ce qui sort de
    // la bibliothèque doit se ranger comme le reste des documents du cabinet.
    filename: templateDownloadFilename({
      title: version.templateDocument.title,
      stage: version.stage,
      versionLabel: version.versionLabel,
      originalFilename: version.originalFilename,
      createdAt: version.createdAt,
    }),
  });
}

// Suppression d'une version. Contrairement aux pièces d'un dossier client — où
// « chacun ne supprime que son propre dernier dépôt » et où l'historique complet fait
// foi — un gabarit interne n'est la preuve de rien : c'est du matériau de travail, et
// Sandrine a explicitement demandé à pouvoir « ajouter, modifier, supprimer les
// documents vierges ». Les deux règles diffèrent parce que les deux objets diffèrent.
export async function deleteTemplateVersion(versionId: string): Promise<{ error: string } | null> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const version = await prisma.templateVersion.findFirst({
    where: { id: versionId, templateDocument: { tenantId } },
    select: {
      id: true,
      fileStorageKey: true,
      stage: true,
      versionLabel: true,
      templateDocumentId: true,
    },
  });
  if (!version) notFound();

  // Le fichier d'abord : supprimer la ligne en premier perdrait la clé de stockage,
  // et l'objet resterait dans le bucket sans que rien ne sache le désigner.
  await getFileStoragePort().delete(version.fileStorageKey);
  await prisma.templateVersion.delete({ where: { id: version.id } });

  await recordAuditEvent({
    action: "TEMPLATE_VERSION_DELETED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: version.id,
    detail: `${version.stage} ${version.versionLabel}`,
  });

  revalidatePath(LIBRARY_PATH);
  revalidatePath(`${LIBRARY_PATH}/${version.templateDocumentId}`);
  return null;
}

// Suppression d'une fiche de modèle — SEULEMENT quand elle est vide. La contrainte
// n'est pas de la prudence de principe : la cascade emporterait les lignes de version
// sans que rien ne retire les fichiers du bucket, qui deviendraient des objets
// orphelins que plus aucune clé ne désigne.
export async function deleteTemplate(templateId: string): Promise<{ error: string } | null> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const template = await prisma.templateDocument.findFirst({
    where: { id: templateId, tenantId },
    select: { id: true, title: true, _count: { select: { versions: true } } },
  });
  if (!template) notFound();

  if (template._count.versions > 0) {
    return {
      error: "Supprimez d'abord les versions de ce modèle — les fichiers doivent être retirés du stockage.",
    };
  }

  await prisma.templateDocument.delete({ where: { id: template.id } });

  await recordAuditEvent({
    action: "TEMPLATE_DOCUMENT_DELETED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: template.id,
  });

  revalidatePath(LIBRARY_PATH);
  redirect(LIBRARY_PATH);
}
