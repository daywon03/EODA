"use server";

import { prisma, Prisma, TemplateDocumentKind, TemplateStage } from "@eoda/database";
import type { UserRole } from "@eoda/database";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetAdminSession, requireCabinetSession } from "@/lib/auth/guards";
import {
  firstError,
  optionalString,
  optionalEnum,
  requiredEnum,
  requiredString,
} from "@/lib/validation/form-parsers";
import { validateUploadedFile } from "@/lib/security/upload-validation-service";
import { getFileStoragePort } from "@/lib/storage";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  buildTemplateStorageKey,
  categoryNameError,
  compareVersionLabelsDesc,
  normaliseCategoryName,
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
// tout le monde travaillera désormais dessus ; créer ou supprimer un dossier, c'est
// décider de la façon dont tout le monde retrouvera ses documents.
//
// JAMAIS de client, sous aucune forme. Rien ici n'est rattaché à un établissement, et
// aucune de ces actions n'est atteignable depuis le portail : ce sont les outils de
// travail d'EODA, pas des pièces de dossier.
// ─────────────────────────────────────────────────────────────────────────────

const LIBRARY_PATH = "/dashboard/cabinet/modeles";

type ActionResult = { error: string } | null;

// ═════════════════════════════════════════════════════════════════════════════
// LES DOSSIERS
// ═════════════════════════════════════════════════════════════════════════════

export type CategorySummary = { id: string; name: string; position: number; templateCount: number };

export async function listTemplateCategories(): Promise<CategorySummary[]> {
  const { tenantId } = await requireCabinetSession();

  const categories = await prisma.templateCategory.findMany({
    where: { tenantId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, position: true, _count: { select: { documents: true } } },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    position: category.position,
    templateCount: category._count.documents,
  }));
}

export async function createTemplateCategory(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { tenantId } = await requireCabinetAdminSession();

  const raw = requiredString(formData, "name", "Le nom du dossier", 80);
  if (!raw.ok) return { error: raw.error };

  const name = normaliseCategoryName(raw.value);
  const nameError = categoryNameError(name);
  if (nameError) return { error: nameError };

  // Le dernier rang plus un : un dossier créé se pose à la fin, là où on l'attend.
  // Le classer d'office en tête déplacerait un rangement que personne n'a demandé à
  // changer.
  const last = await prisma.templateCategory.findFirst({
    where: { tenantId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  try {
    await prisma.templateCategory.create({
      data: { tenantId, name, position: (last?.position ?? 0) + 1 },
    });
  } catch (error) {
    // Contrainte d'unicité : nommer le vrai problème plutôt que laisser sortir un
    // message technique. La casse et les accents ne sont PAS couverts par l'index —
    // « Qualité » et « qualite » resteront deux dossiers, et c'est assumé : trancher
    // à la place de la consultante sur ce que deux noms proches veulent dire serait
    // plus faux que de la laisser les fusionner elle-même.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Un dossier porte déjà ce nom." };
    }
    throw error;
  }

  revalidatePath(LIBRARY_PATH);
  return null;
}

export async function renameTemplateCategory(
  categoryId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { tenantId } = await requireCabinetAdminSession();

  // `categoryId` arrive par une route HTTP publique : l'appartenance au tenant se
  // vérifie en base, jamais sur la foi de l'écran qui l'a envoyé.
  const category = await prisma.templateCategory.findFirst({
    where: { id: categoryId, tenantId },
    select: { id: true },
  });
  if (!category) notFound();

  const raw = requiredString(formData, "name", "Le nom du dossier", 80);
  if (!raw.ok) return { error: raw.error };

  const name = normaliseCategoryName(raw.value);
  const nameError = categoryNameError(name);
  if (nameError) return { error: nameError };

  try {
    await prisma.templateCategory.update({ where: { id: category.id }, data: { name } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Un dossier porte déjà ce nom." };
    }
    throw error;
  }

  revalidatePath(LIBRARY_PATH);
  return null;
}

// Déplacement d'un cran, par ÉCHANGE de rangs avec le voisin. Une réécriture de toute
// la colonne à chaque déplacement ferait le même travail en touchant toutes les
// lignes ; l'échange ne touche que les deux concernées et ne peut pas laisser de trou.
export async function moveTemplateCategory(
  categoryId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const { tenantId } = await requireCabinetAdminSession();

  const category = await prisma.templateCategory.findFirst({
    where: { id: categoryId, tenantId },
    select: { id: true, position: true },
  });
  if (!category) notFound();

  const neighbour = await prisma.templateCategory.findFirst({
    where: {
      tenantId,
      position: direction === "up" ? { lt: category.position } : { gt: category.position },
    },
    orderBy: { position: direction === "up" ? "desc" : "asc" },
    select: { id: true, position: true },
  });
  // Déjà en bout de liste : ne rien faire est la bonne réponse, pas une erreur.
  if (!neighbour) return null;

  await prisma.$transaction([
    prisma.templateCategory.update({
      where: { id: category.id },
      data: { position: neighbour.position },
    }),
    prisma.templateCategory.update({
      where: { id: neighbour.id },
      data: { position: category.position },
    }),
  ]);

  revalidatePath(LIBRARY_PATH);
  return null;
}

// Suppression d'un dossier — SEULEMENT quand il est vide. Emporter les fiches avec lui
// supprimerait des fichiers du stockage sans que personne ne l'ait demandé, et un
// dossier se supprime souvent par erreur de rangement, pas par volonté d'effacer.
export async function deleteTemplateCategory(categoryId: string): Promise<ActionResult> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const category = await prisma.templateCategory.findFirst({
    where: { id: categoryId, tenantId },
    select: { id: true, name: true, _count: { select: { documents: true } } },
  });
  if (!category) notFound();

  if (category._count.documents > 0) {
    return {
      error: "Ce dossier contient encore des modèles. Déplacez-les d'abord dans un autre dossier.",
    };
  }

  await prisma.templateCategory.delete({ where: { id: category.id } });

  await recordAuditEvent({
    action: "TEMPLATE_CATEGORY_DELETED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: category.id,
    detail: category.name,
  });

  revalidatePath(LIBRARY_PATH);
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// LES FICHES
// ═════════════════════════════════════════════════════════════════════════════

export type TemplateSummary = {
  id: string;
  title: string;
  kind: TemplateDocumentKind;
  description: string | null;
  versionCount: number;
  updatedAt: Date;
  // Stades pour lesquels au moins une version existe : c'est ce qui dit d'un coup
  // d'œil qu'il manque encore la version vierge d'un gabarit.
  stages: TemplateStage[];
};

export type LibraryFolder = { id: string; name: string; templates: TemplateSummary[] };

// La bibliothèque se lit comme une arborescence : les dossiers dans l'ordre décidé à
// la main, les fiches dedans. Une seule requête — un `findMany` par dossier ferait
// autant d'allers-retours que de dossiers, pour la même donnée.
export async function listLibrary(): Promise<LibraryFolder[]> {
  const { tenantId } = await requireCabinetSession();

  const categories = await prisma.templateCategory.findMany({
    where: { tenantId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      documents: {
        orderBy: { title: "asc" },
        include: { versions: { select: { stage: true } } },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    templates: category.documents.map((template) => ({
      id: template.id,
      title: template.title,
      kind: template.kind,
      description: template.description,
      versionCount: template.versions.length,
      updatedAt: template.updatedAt,
      stages: [
        ...new Set(
          template.versions
            .map((version) => version.stage)
            .filter((stage): stage is TemplateStage => stage !== null)
        ),
      ],
    })),
  }));
}

export type TemplateDetail = {
  id: string;
  title: string;
  kind: TemplateDocumentKind;
  categoryId: string;
  categoryName: string;
  description: string | null;
  versions: {
    id: string;
    stage: TemplateStage | null;
    versionLabel: string | null;
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
      category: { select: { id: true, name: true } },
      versions: { include: { uploadedBy: { select: { name: true } } } },
    },
  });
  if (!template) notFound();

  return {
    id: template.id,
    title: template.title,
    kind: template.kind,
    categoryId: template.category.id,
    categoryName: template.category.name,
    description: template.description,
    versions: [...template.versions]
      // Tri par numéro de version décroissant, segment par segment : « v10 » vient
      // après « v9 », ce qu'un tri de chaînes ferait à l'envers. Un document de
      // référence n'a pas de numéro : il se range alors du plus récemment déposé au
      // plus ancien, seul ordre qui ait un sens pour lui.
      .sort((a, b) => {
        if (a.versionLabel && b.versionLabel) {
          return compareVersionLabelsDesc(a.versionLabel, b.versionLabel);
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
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
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { tenantId } = await requireCabinetAdminSession();

  const title = requiredString(formData, "title", "Le titre du modèle", 200);
  const categoryId = requiredString(formData, "categoryId", "Le dossier", 40);
  const kind = requiredEnum(formData, "kind", "La nature du document", TemplateDocumentKind);
  const description = optionalString(formData, "description", "La description", 1000);

  const error = firstError(title, categoryId, kind, description);
  if (error) return { error };
  if (!title.ok || !categoryId.ok || !kind.ok || !description.ok) {
    return { error: "Formulaire invalide." };
  }

  const category = await prisma.templateCategory.findFirst({
    where: { id: categoryId.value, tenantId },
    select: { id: true },
  });
  if (!category) return { error: "Ce dossier n'existe pas." };

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
      categoryId: category.id,
      kind: kind.value,
      description: description.value,
    },
    select: { id: true },
  });

  revalidatePath(LIBRARY_PATH);
  redirect(`${LIBRARY_PATH}/${template.id}`);
}

// « Que l'on puisse ensuite les réarranger » : un import de dossier range au mieux, il
// ne range pas juste à tous les coups, et l'arborescence d'un poste ne suit pas
// forcément celle qu'on veut dans la bibliothèque.
export async function moveTemplateToCategory(
  templateId: string,
  categoryId: string
): Promise<ActionResult> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  // Les DEUX identifiants viennent d'une route publique : les deux se vérifient.
  // Ne contrôler que la fiche laisserait déplacer un modèle vers le dossier d'un
  // autre cabinet, ce qui l'y rendrait visible.
  const [template, category] = await Promise.all([
    prisma.templateDocument.findFirst({
      where: { id: templateId, tenantId },
      select: { id: true, categoryId: true },
    }),
    prisma.templateCategory.findFirst({
      where: { id: categoryId, tenantId },
      select: { id: true, name: true },
    }),
  ]);
  if (!template || !category) notFound();
  if (template.categoryId === category.id) return null;

  await prisma.templateDocument.update({
    where: { id: template.id },
    data: { categoryId: category.id },
  });

  await recordAuditEvent({
    action: "TEMPLATE_DOCUMENT_MOVED",
    actorUserId: userId,
    actorRole: session.user.role,
    targetId: template.id,
    detail: category.name,
  });

  revalidatePath(LIBRARY_PATH);
  revalidatePath(`${LIBRARY_PATH}/${template.id}`);
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
// LES FICHIERS
// ═════════════════════════════════════════════════════════════════════════════

// Stade et numéro de version sont exigés SUR UN GABARIT et interdits sur un document
// de référence. La base ne sait pas exprimer « obligatoire selon le parent » : c'est
// donc ici que la règle vit, et dans les tests du service qui l'accompagne.
type VersionIdentity = { stage: TemplateStage | null; versionLabel: string | null };

function resolveVersionIdentity(
  kind: TemplateDocumentKind,
  rawStage: string | null,
  rawLabel: string | null
): VersionIdentity | { error: string } {
  if (kind === "REFERENCE") {
    // Ni stade ni numéro imposé — un millésime facultatif suffit à distinguer deux
    // éditions du manuel HAS, et il est stocké tel quel plutôt que reformaté en
    // « v… », qui prétendrait qu'EODA en numérote les versions.
    const label = (rawLabel ?? "").trim();
    return { stage: null, versionLabel: label.length > 0 ? label.slice(0, 40) : null };
  }

  if (rawStage === null || !(rawStage in TemplateStage)) {
    return { error: "Le stade du document est obligatoire." };
  }
  const versionLabel = normaliseVersionLabel(rawLabel ?? "");
  const labelError = versionLabelError(versionLabel);
  if (labelError) return { error: labelError };

  return { stage: rawStage as TemplateStage, versionLabel };
}

export async function uploadTemplateVersion(
  templateId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const template = await prisma.templateDocument.findFirst({
    where: { id: templateId, tenantId },
    select: { id: true, kind: true },
  });
  if (!template) notFound();

  const changeNote = optionalString(formData, "changeNote", "La note de version", 500);
  if (!changeNote.ok) return { error: changeNote.error };

  const identity = resolveVersionIdentity(
    template.kind,
    formData.get("stage") instanceof File ? null : (formData.get("stage") as string | null),
    formData.get("versionLabel") instanceof File
      ? null
      : (formData.get("versionLabel") as string | null)
  );
  if ("error" in identity) return { error: identity.error };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Aucun fichier sélectionné." };

  return storeVersion({
    templateId: template.id,
    identity,
    changeNote: changeNote.value,
    file,
    userId,
    role: session.user.role,
    auditAction: "TEMPLATE_VERSION_UPLOADED",
  });
}

// Écriture d'une version : partagée par le dépôt à l'unité et par l'import de dossier.
// Les deux chemins doivent valider le fichier de la même façon et écrire les mêmes
// lignes — deux copies auraient fini par diverger sur exactement le contrôle qui
// compte, celui du type réel du fichier.
async function storeVersion(params: {
  templateId: string;
  identity: VersionIdentity;
  changeNote: string | null;
  file: File;
  userId: string;
  role: UserRole;
  auditAction: "TEMPLATE_VERSION_UPLOADED" | "TEMPLATE_FOLDER_IMPORTED";
  auditDetail?: string;
}): Promise<ActionResult> {
  const { templateId, identity, changeNote, file, userId, role, auditAction } = params;

  const buffer = Buffer.from(await file.arrayBuffer());
  // Type réel déterminé par la SIGNATURE BINAIRE, jamais par `file.type` — valeur
  // fournie par le client, donc falsifiable. Même règle que le dépôt de pièces.
  const validation = validateUploadedFile(buffer, file.size);
  if (!validation.ok) return { error: `${file.name} : ${validation.error}` };

  const duplicate = await prisma.templateVersion.findFirst({
    where: {
      templateDocumentId: templateId,
      stage: identity.stage,
      versionLabel: identity.versionLabel,
    },
    select: { id: true },
  });
  if (duplicate && identity.stage !== null) {
    return { error: `La version ${identity.versionLabel} existe déjà pour ce stade.` };
  }

  const storageKey = buildTemplateStorageKey({
    templateDocumentId: templateId,
    stage: identity.stage,
    versionLabel: identity.versionLabel,
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
      stage: identity.stage,
      versionLabel: identity.versionLabel,
      changeNote,
      fileStorageKey: storageKey,
      originalFilename: file.name,
      contentType: validation.contentType,
      sizeBytes: buffer.length,
      uploadedByUserId: userId,
    },
    select: { id: true },
  });

  // `detail` = le stade et le libellé de version, jamais le nom du fichier : celui-ci
  // porte souvent le nom d'une structure.
  await recordAuditEvent({
    action: auditAction,
    actorUserId: userId,
    actorRole: role,
    targetId: version.id,
    detail: params.auditDetail ?? `${identity.stage ?? "REFERENCE"} ${identity.versionLabel ?? ""}`.trim(),
  });

  revalidatePath(LIBRARY_PATH);
  revalidatePath(`${LIBRARY_PATH}/${templateId}`);
  return null;
}

// ── Import d'un dossier, fichier par fichier ─────────────────────────────────
//
// UN APPEL PAR FICHIER, et c'est délibéré : envoyer cinquante fichiers dans une seule
// requête ferait un corps de plusieurs centaines de mégaoctets, qu'aucune passerelle
// n'accepte, et une coupure au trente-septième perdrait les trente-six premiers.
// Fichier par fichier, l'écran avance, et ce qui est passé est passé.
//
// Le dossier et la fiche sont créés à la volée s'ils n'existent pas : c'est tout
// l'intérêt de « les fichiers se mettent tout seuls ». Ils sont RÉUTILISÉS s'ils
// existent — un import ne doit jamais créer un second « Livret d'accueil » à côté du
// premier.
export type ImportFileResult = { ok: true } | { error: string };

export async function importTemplateFile(formData: FormData): Promise<ImportFileResult> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const rawCategory = requiredString(formData, "categoryName", "Le dossier", 80);
  const rawTitle = requiredString(formData, "title", "Le titre du modèle", 200);
  const stage = optionalEnum(formData, "stage", "Le stade du document", TemplateStage);
  const parseError = firstError(rawCategory, rawTitle, stage);
  if (parseError) return { error: parseError };
  if (!rawCategory.ok || !rawTitle.ok || !stage.ok) return { error: "Ligne d'import invalide." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Fichier manquant." };

  const categoryName = normaliseCategoryName(rawCategory.value);
  const categoryError = categoryNameError(categoryName);
  if (categoryError) return { error: categoryError };

  const title = rawTitle.value.trim();
  if (title.length === 0) return { error: `${file.name} : titre de modèle vide.` };

  // Nature déduite du stade choisi À L'ÉCRAN d'aperçu : « pas de stade » veut dire
  // « document de référence ». Un second contrôle serait un second endroit où la
  // règle peut diverger.
  const kind: TemplateDocumentKind = stage.value === null ? "REFERENCE" : "GABARIT";

  const category =
    (await prisma.templateCategory.findFirst({
      where: { tenantId, name: categoryName },
      select: { id: true },
    })) ??
    (await createCategoryAtEnd(tenantId, categoryName));

  let template = await prisma.templateDocument.findFirst({
    where: { tenantId, title },
    select: { id: true, kind: true },
  });

  if (!template) {
    template = await prisma.templateDocument.create({
      data: { tenantId, title, categoryId: category.id, kind },
      select: { id: true, kind: true },
    });
  } else if (template.kind !== kind) {
    // La fiche existe déjà avec l'autre nature. On ne la convertit PAS en silence :
    // basculer un gabarit en document de référence rendrait ses trois stades
    // inaccessibles. La ligne est refusée en le disant.
    return {
      error: `${title} : cette fiche est déjà un ${template.kind === "GABARIT" ? "gabarit" : "document de référence"}.`,
    };
  }

  const identity = resolveVersionIdentity(
    kind,
    stage.value,
    formData.get("versionLabel") instanceof File
      ? null
      : (formData.get("versionLabel") as string | null)
  );
  if ("error" in identity) return { error: `${file.name} : ${identity.error}` };

  const result = await storeVersion({
    templateId: template.id,
    identity,
    changeNote: null,
    file,
    userId,
    role: session.user.role,
    auditAction: "TEMPLATE_FOLDER_IMPORTED",
    auditDetail: categoryName,
  });

  return result ? { error: result.error } : { ok: true };
}

async function createCategoryAtEnd(tenantId: string, name: string) {
  const last = await prisma.templateCategory.findFirst({
    where: { tenantId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  try {
    return await prisma.templateCategory.create({
      data: { tenantId, name, position: (last?.position ?? 0) + 1 },
      select: { id: true },
    });
  } catch (error) {
    // Deux fichiers du même dossier importés coup sur coup : le second retrouve le
    // dossier que le premier vient de créer plutôt que d'échouer.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.templateCategory.findFirst({
        where: { tenantId, name },
        select: { id: true },
      });
      if (existing) return existing;
    }
    throw error;
  }
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
export async function deleteTemplateVersion(versionId: string): Promise<ActionResult> {
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
    detail: `${version.stage ?? "REFERENCE"} ${version.versionLabel ?? ""}`.trim(),
  });

  revalidatePath(LIBRARY_PATH);
  revalidatePath(`${LIBRARY_PATH}/${version.templateDocumentId}`);
  return null;
}

// Suppression d'une fiche de modèle — SEULEMENT quand elle est vide. La contrainte
// n'est pas de la prudence de principe : la cascade emporterait les lignes de version
// sans que rien ne retire les fichiers du bucket, qui deviendraient des objets
// orphelins que plus aucune clé ne désigne.
export async function deleteTemplate(templateId: string): Promise<ActionResult> {
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
